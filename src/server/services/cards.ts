import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import type { CardDesign, CardOrder, CardOrderStatus, CardSnapshot, DriverProfile, User } from "@/lib/db/types";
import { newId } from "@/lib/id";
import { initials } from "@/lib/names";
import { providerLabel } from "@/lib/providers";
import { CURRENCY } from "@/lib/money";
import { CARD_QUANTITIES, cardProductFor, quoteCardOrder } from "@/lib/pricing";
import { DEFAULT_HEADLINE, MAX_HEADLINE_LENGTH, defaultCardDesign } from "@/lib/card/design";
import { renderCardSvg } from "@/lib/card/svg";
import { ServiceError, notFound } from "../errors";
import { qrSvg, thankYouUrl } from "../qr";
import { sendMail } from "../mail";
import { emails } from "../emails";
import { baseUrl } from "../site";
import { avatarUrl, driverPublicName } from "./drivers";

/* ---------- Design ---------- */

export async function getCardDesign(driverId: string): Promise<CardDesign> {
  const db = getDb();
  const existing = await db.cardDesigns.findOne({ driverId });
  if (existing) return existing;
  // Ältere Konten ohne Design bekommen beim ersten Aufruf das Standarddesign.
  return db.cardDesigns.insert({ id: newId(), driverId, ...defaultCardDesign(), updatedAt: new Date().toISOString() });
}

export const cardDesignSchema = z.object({
  layout: z.enum(["classic", "brand", "personal"]),
  headline: z
    .string()
    .trim()
    .max(MAX_HEADLINE_LENGTH, `Höchstens ${MAX_HEADLINE_LENGTH} Zeichen.`)
    .transform((value) => value.replace(/\s+/g, " ") || DEFAULT_HEADLINE),
  showPhoto: z.boolean(),
  showProvider: z.boolean(),
});

export async function saveCardDesign(driverId: string, input: z.infer<typeof cardDesignSchema>): Promise<void> {
  const design = await getCardDesign(driverId);
  await getDb().cardDesigns.update(design.id, { ...input, updatedAt: new Date().toISOString() });
}

/** Alles, was eine Kartenvorschau braucht – serverseitig vorberechnet. */
export async function cardContext(driver: DriverProfile, user: User) {
  const design = await getCardDesign(driver.id);
  const url = thankYouUrl(driver.code);
  const name = driverPublicName(driver, user);
  return {
    design,
    qr: await qrSvg(url),
    url,
    publicName: name,
    initials: initials(name),
    providerLabel: providerLabel(driver.providerId),
    photoUrl: avatarUrl(driver),
    code: driver.code,
  };
}

/** Karte als fertiges SVG, z. B. für die Druckansicht. */
export async function renderDriverCard(driver: DriverProfile, user: User, idPrefix = "ld"): Promise<string> {
  const ctx = await cardContext(driver, user);
  return renderCardSvg({
    layout: ctx.design.layout,
    headline: ctx.design.headline,
    publicName: ctx.publicName,
    providerLabel: ctx.design.showProvider ? ctx.providerLabel : null,
    code: ctx.code,
    qrSvg: ctx.qr,
    avatar:
      ctx.design.showPhoto || ctx.design.layout === "personal"
        ? { href: ctx.design.showPhoto ? ctx.photoUrl : null, initials: ctx.initials }
        : null,
    idPrefix,
  });
}

/* ---------- Bestellung ---------- */

export const cardOrderSchema = z.object({
  quantity: z.coerce
    .number()
    .int()
    .refine((value) => (CARD_QUANTITIES as readonly number[]).includes(value), "Bitte eine Stückzahl wählen."),
  shippingName: z.string().trim().min(2, "Bitte gib einen Namen an.").max(80),
  shippingStreet: z.string().trim().min(3, "Bitte gib Straße und Hausnummer an.").max(120),
  shippingPostalCode: z.string().trim().regex(/^\d{5}$/, "Bitte eine fünfstellige Postleitzahl angeben."),
  shippingCity: z.string().trim().min(2, "Bitte gib den Ort an.").max(80),
  reorderOf: z.string().trim().max(60).optional().or(z.literal("")),
});

export async function createCardOrder(
  user: User,
  driver: DriverProfile,
  input: z.infer<typeof cardOrderSchema>,
): Promise<CardOrder> {
  const db = getDb();

  // Schutz vor versehentlichen Mehrfachbestellungen.
  const open = await db.cardOrders.findMany({ where: { driverId: driver.id } });
  if (open.filter((o) => ["requested", "confirmed", "in_production"].includes(o.status)).length >= 3) {
    throw new ServiceError("too_many_orders", "Du hast bereits mehrere offene Bestellungen.", 409);
  }

  const ctx = await cardContext(driver, user);
  const product = cardProductFor(ctx.design, DEFAULT_HEADLINE);
  const quote = quoteCardOrder(product, input.quantity);
  const now = new Date().toISOString();

  const design: CardSnapshot = {
    layout: ctx.design.layout,
    headline: ctx.design.headline,
    showPhoto: ctx.design.showPhoto,
    showProvider: ctx.design.showProvider,
    publicName: ctx.publicName,
    providerLabel: ctx.design.showProvider ? ctx.providerLabel : null,
    code: driver.code,
    qrUrl: ctx.url,
  };

  const order = await db.cardOrders.insert({
    id: newId(),
    driverId: driver.id,
    product,
    quantity: input.quantity,
    unitPriceCents: quote.unitPriceCents,
    totalCents: quote.totalCents,
    currency: CURRENCY,
    // Bezahlte Bestellungen laufen später über denselben Payment-Layer wie Trinkgelder.
    paymentStatus: quote.free ? "not_required" : "pending",
    paymentId: null,
    design,
    shippingName: input.shippingName,
    shippingStreet: input.shippingStreet,
    shippingPostalCode: input.shippingPostalCode,
    shippingCity: input.shippingCity,
    shippingCountry: "DE",
    status: "requested",
    carrier: null,
    trackingNumber: null,
    reorderOf: input.reorderOf || null,
    createdAt: now,
    updatedAt: now,
    shippedAt: null,
  });

  await sendMail(user.email, emails.cardOrderReceived(user.firstName, order, `${baseUrl()}/dashboard/karte/bestellen`), "card_order");
  return order;
}

export async function cancelCardOrder(driverId: string, orderId: string): Promise<void> {
  const db = getDb();
  const order = await db.cardOrders.get(orderId);
  if (!order || order.driverId !== driverId) throw notFound();
  if (order.status !== "requested") {
    throw new ServiceError("not_cancellable", "Diese Bestellung ist schon in Bearbeitung.", 409);
  }
  await db.cardOrders.update(order.id, { status: "cancelled", updatedAt: new Date().toISOString() });
}

export const CARD_ORDER_STATUS_LABELS: Record<CardOrderStatus, string> = {
  requested: "Eingegangen",
  confirmed: "Bestätigt",
  in_production: "In Produktion",
  shipped: "Versendet",
  delivered: "Zugestellt",
  cancelled: "Storniert",
};

/** Adminseitige Statusänderung. Beim Versand geht eine Mail an den Zusteller. */
export async function updateCardOrderStatus(
  orderId: string,
  status: CardOrderStatus,
  tracking: { carrier?: string | null; trackingNumber?: string | null },
): Promise<CardOrder> {
  const db = getDb();
  const order = await db.cardOrders.get(orderId);
  if (!order) throw notFound();

  const now = new Date().toISOString();
  const patch: Partial<CardOrder> = {
    status,
    carrier: tracking.carrier?.trim() || order.carrier,
    trackingNumber: tracking.trackingNumber?.trim() || order.trackingNumber,
    updatedAt: now,
  };
  if (status === "shipped" && !order.shippedAt) patch.shippedAt = now;
  await db.cardOrders.update(order.id, patch);

  const updated = { ...order, ...patch } as CardOrder;
  if (status === "shipped" && order.status !== "shipped") {
    const driver = await db.driverProfiles.get(order.driverId);
    const user = driver ? await db.users.get(driver.userId) : null;
    if (user) {
      await sendMail(user.email, emails.cardOrderShipped(user.firstName, updated, `${baseUrl()}/dashboard/karte/bestellen`), "card_shipped");
    }
  }
  return updated;
}
