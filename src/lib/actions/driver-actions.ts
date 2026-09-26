"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { newId } from "@/lib/id";
import { DELIVERY_PROVIDERS } from "@/lib/providers";
import { getPaymentProvider } from "@/lib/payments";
import { baseUrl } from "@/lib/qr";
import type { FormState } from "./auth-actions";

const providerIds = DELIVERY_PROVIDERS.map((p) => p.id);

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Bitte gib einen Anzeigenamen an.")
    .max(30, "Höchstens 30 Zeichen."),
  providerId: z.string().trim().optional(),
  city: z.string().trim().max(60).optional(),
});

async function requireDriver() {
  const session = await getSession();
  if (!session?.driver) redirect("/login");
  return session;
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { driver } = await requireDriver();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { fieldErrors };
  }

  const { displayName, providerId, city } = parsed.data;
  const nextProvider = providerId && providerIds.includes(providerId) ? providerId : null;

  await getStore().updateDriverProfile(driver!.id, {
    displayName,
    city: city || null,
    providerId: nextProvider,
    // Eine geaenderte Anbieterangabe gilt wieder als ungeprueft (§19).
    providerVerified: nextProvider === driver!.providerId ? driver!.providerVerified : false,
  });

  revalidatePath("/dashboard/profil");
  revalidatePath("/dashboard");
  return { saved: true };
}

const verificationSchema = z.object({
  documentNote: z
    .string()
    .trim()
    .min(10, "Bitte beschreibe kurz, wie wir deine Tätigkeit prüfen können.")
    .max(500),
});

/**
 * Fragt das freiwillige Vertrauensabzeichen an.
 * Ein Mensch prueft die Angabe im Adminbereich. Der Danke-Code funktioniert
 * unabhaengig davon -- das Abzeichen ist reines Vertrauenssignal.
 */
export async function submitVerification(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, driver } = await requireDriver();
  const parsed = verificationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: { documentNote: parsed.error.issues[0].message } };
  }

  const store = getStore();
  const existing = await store.getVerificationByUserId(user.id);
  await store.upsertVerification({
    id: existing?.id ?? newId(),
    userId: user.id,
    identityStatus: "pending",
    driverStatus: "pending",
    documentNote: parsed.data.documentNote,
    reviewNote: existing?.reviewNote ?? null,
    updatedAt: new Date().toISOString(),
  });

  if (driver!.verification === "unverified" || driver!.verification === "rejected") {
    await store.updateDriverProfile(driver!.id, { verification: "pending" });
  }

  revalidatePath("/dashboard/profil");
  revalidatePath("/dashboard");
  return { saved: true };
}

export async function setActive(active: boolean): Promise<void> {
  const { driver } = await requireDriver();
  await getStore().updateDriverProfile(driver!.id, { active });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profil");
}

/**
 * Bereitet das Auszahlungskonto vor.
 * Die Identitaetspruefung (KYC) uebernimmt der Zahlungsdienstleister -- dort,
 * wo sie fuer Auszahlungen gesetzlich verlangt wird.
 */
export async function startPayoutOnboarding(): Promise<void> {
  const { user, driver } = await requireDriver();
  const provider = getPaymentProvider();
  const store = getStore();

  let accountId = driver!.payoutAccountId;
  if (!accountId) {
    accountId = await provider.createConnectedAccount({ email: user.email, driverId: driver!.id });
    await store.updateDriverProfile(driver!.id, { payoutAccountId: accountId });
  }

  const link = await provider.onboardDriver({
    accountId,
    returnUrl: `${baseUrl()}/dashboard/einnahmen?konto=fertig`,
    refreshUrl: `${baseUrl()}/dashboard/einnahmen?konto=neu`,
  });

  redirect(link.url);
}

/** Prueft beim Provider, ob das Auszahlungskonto einsatzbereit ist. */
export async function refreshPayoutStatus(): Promise<void> {
  const { driver } = await requireDriver();
  if (!driver!.payoutAccountId) return;
  const ready = await getPaymentProvider().isAccountReady(driver!.payoutAccountId);
  await getStore().updateDriverProfile(driver!.id, { payoutReady: ready });
  revalidatePath("/dashboard/einnahmen");
}

/**
 * Kontolöschung nach DSGVO (§47).
 * Zahlungsdatensaetze bleiben aus buchhalterischen Gruenden bestehen,
 * verlieren aber jeden Personenbezug.
 */
export async function deleteAccount(): Promise<void> {
  const { user, driver } = await requireDriver();
  const store = getStore();
  const now = new Date().toISOString();

  await store.updateDriverProfile(driver!.id, {
    displayName: "Gelöschtes Profil",
    active: false,
    providerId: null,
    providerVerified: false,
    city: null,
    payoutAccountId: null,
    payoutReady: false,
  });

  await store.updateUser(user.id, {
    name: "Gelöschtes Konto",
    email: `geloescht+${user.id}@lieferdank.invalid`,
    phone: null,
    passwordHash: "geloescht",
    blockedAt: now,
    blockedReason: "Vom Nutzer gelöscht",
  });

  await store.createAdminAction({
    id: newId(),
    actorEmail: "self-service",
    targetId: user.id,
    action: "account_deleted",
    reason: "DSGVO-Löschung durch den Nutzer",
    createdAt: now,
  });

  redirect("/?geloescht=1");
}
