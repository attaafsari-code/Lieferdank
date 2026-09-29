import Link from "next/link";
import { requireDriver } from "@/server/guards";
import { getDb } from "@/lib/db";
import { cardContext, CARD_ORDER_STATUS_LABELS } from "@/server/services/cards";
import { CARD_PRODUCT_LABELS, CARD_QUANTITIES, cardOrdersArePaid, cardProductFor, quoteCardOrder } from "@/lib/pricing";
import { DEFAULT_HEADLINE } from "@/lib/card/design";
import { formatDateTime, formatEuro } from "@/lib/format";
import { CardPreview } from "@/components/card-preview";
import { PageTitle, SectionTitle } from "@/components/dashboard-ui";
import { OrderForm, CancelOrderButton } from "./order-form";
import { isProductionRuntime } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Karte bestellen" };

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { user, driver } = await requireDriver();
  const query = await searchParams;
  const [card, orders] = await Promise.all([
    cardContext(driver, user),
    getDb().cardOrders.findMany({ where: { driverId: driver.id }, orderBy: "createdAt", desc: true }),
  ]);

  const product = cardProductFor(card.design, DEFAULT_HEADLINE);
  const quotes = CARD_QUANTITIES.map((quantity) => quoteCardOrder(product, quantity));
  const lastOrder = orders.find((order) => order.status !== "cancelled");

  return (
    <div className="space-y-12">
      <Link href="/dashboard/karte" className="text-sm font-semibold text-brand hover:underline">
        ← Zurück zur Karte
      </Link>

      <PageTitle
        title="Plastikkarte bestellen"
        lead="Deine Karte als echte Plastikkarte im Scheckkartenformat – robust, wasserfest und mit deinem Design."
      />

      {query.bestellt === "1" && (
        <p className="rounded-2xl bg-brand-50 px-5 py-4 text-sm font-semibold text-brand-900">
          Danke! Deine Bestellung ist eingegangen. Du bekommst eine Bestätigung per E-Mail.
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <div className="rounded-3xl bg-gradient-to-br from-brand-50 via-white to-coral-50 p-6">
            <CardPreview
              className="overflow-hidden rounded-xl shadow-lg"
              layout={card.design.layout}
              headline={card.design.headline}
              publicName={card.publicName}
              providerLabel={card.design.showProvider ? card.providerLabel : null}
              code={card.code}
              qrSvg={card.qr}
              avatar={
                card.design.showPhoto || card.design.layout === "personal"
                  ? { href: card.design.showPhoto ? card.photoUrl : null, initials: card.initials }
                  : null
              }
              idPrefix="order"
            />
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            {CARD_PRODUCT_LABELS[product]} ·{" "}
            <Link href="/dashboard/karte" className="font-semibold text-brand hover:underline">
              Design ändern
            </Link>
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-white p-6 shadow-xs sm:p-7">
          {isProductionRuntime() && !cardOrdersArePaid() ? (
            <p className="text-sm leading-relaxed text-ink-soft">Physische Karten sind derzeit nicht bestellbar. Deinen digitalen QR-Code kannst du kostenlos herunterladen und selbst ausdrucken.</p>
          ) : <OrderForm
            quotes={quotes}
            paid={cardOrdersArePaid()}
            defaults={{
              shippingName: lastOrder?.shippingName ?? `${user.firstName} ${user.lastName}`.trim(),
              shippingStreet: lastOrder?.shippingStreet ?? "",
              shippingPostalCode: lastOrder?.shippingPostalCode ?? "",
              shippingCity: lastOrder?.shippingCity ?? "",
            }}
            reorderOf={lastOrder?.id}
          />}
        </div>
      </div>

      <section>
        <SectionTitle>Deine Bestellungen</SectionTitle>
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-7 text-center text-ink-soft">
            Noch keine Bestellung.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <span className="min-w-0">
                  <span className="block font-bold text-ink">
                    {order.quantity}× {CARD_PRODUCT_LABELS[order.product]}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {formatDateTime(order.createdAt)} · {order.totalCents === 0 ? "kostenlos" : formatEuro(order.totalCents)}
                    {order.trackingNumber && ` · Sendung ${order.trackingNumber}`}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={`chip ${
                      order.status === "shipped" || order.status === "delivered"
                        ? "bg-brand-50 text-brand"
                        : order.status === "cancelled"
                          ? "bg-canvas text-ink-faint"
                          : "bg-coral-50 text-coral-600"
                    }`}
                  >
                    {CARD_ORDER_STATUS_LABELS[order.status]}
                  </span>
                  {order.status === "requested" && <CancelOrderButton orderId={order.id} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
