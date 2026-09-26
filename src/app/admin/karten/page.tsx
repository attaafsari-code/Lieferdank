import { getDb } from "@/lib/db";
import { CARD_ORDER_STATUS_LABELS } from "@/server/services/cards";
import { CARD_PRODUCT_LABELS } from "@/lib/pricing";
import { formatDateTime, formatEuro } from "@/lib/format";
import { AdminTitle, Badge, Empty } from "../ui";
import { OrderControls } from "../admin-controls";

export const dynamic = "force-dynamic";

export default async function AdminCardOrders() {
  const orders = await getDb().cardOrders.findMany({ orderBy: "createdAt", desc: true, limit: 200 });

  return (
    <div>
      <AdminTitle title="Kartenbestellungen" lead="Beim Wechsel auf „Versendet“ bekommt der Lieferant automatisch eine Versandbestätigung." />
      {orders.length === 0 ? (
        <Empty>Noch keine Bestellungen.</Empty>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-2xl border border-line bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-ink">
                  {order.quantity}× {CARD_PRODUCT_LABELS[order.product]}
                </span>
                <span className="chip bg-canvas font-mono text-ink-soft">{order.design.code}</span>
                <Badge tone={order.status === "cancelled" ? "gray" : order.status === "shipped" || order.status === "delivered" ? "blue" : "coral"}>
                  {CARD_ORDER_STATUS_LABELS[order.status]}
                </Badge>
                <Badge>{order.paymentStatus === "not_required" ? "kostenlos" : order.paymentStatus === "paid" ? "bezahlt" : "Zahlung offen"}</Badge>
              </div>
              <p className="mt-1.5 text-sm text-ink-soft">
                {formatDateTime(order.createdAt)} · {order.totalCents ? formatEuro(order.totalCents) : "0,00 €"} · Layout {order.design.layout} ·
                „{order.design.publicName}“ · „{order.design.headline}“
              </p>
              <p className="mt-1 text-sm text-ink">
                {order.shippingName}, {order.shippingStreet}, {order.shippingPostalCode} {order.shippingCity}
              </p>
              <OrderControls orderId={order.id} status={order.status} carrier={order.carrier} trackingNumber={order.trackingNumber} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
