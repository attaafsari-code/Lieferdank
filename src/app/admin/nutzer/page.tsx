import Link from "next/link";
import { getDb } from "@/lib/db";
import { searchUsers } from "@/server/services/admin";
import { driverPublicName } from "@/server/services/drivers";
import { providerLabel } from "@/lib/providers";
import { formatDateTime, formatEuro } from "@/lib/format";
import { AdminTitle, Badge, Empty } from "../ui";
import { BadgeReview, UserControls } from "../admin-controls";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "", label: "Alle" },
  { id: "driver", label: "Lieferanten" },
  { id: "customer", label: "Kunden" },
  { id: "pending", label: "Abzeichen-Anfragen" },
  { id: "blocked", label: "Gesperrt" },
];

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { q = "", status = "" } = await searchParams;
  const db = getDb();
  const [results, tips, verifications] = await Promise.all([
    searchUsers(q),
    db.tips.findMany({ where: { paymentStatus: "succeeded", payoutStatus: "in_balance" } }),
    db.verifications.findMany(),
  ]);

  const balance = new Map<string, number>();
  for (const tip of tips) balance.set(tip.driverId, (balance.get(tip.driverId) ?? 0) + tip.driverCents);
  const notes = new Map(verifications.map((v) => [v.userId, v]));

  const filtered = results.filter(({ user, driver }) => {
    if (status === "driver") return user.role === "driver";
    if (status === "customer") return user.role === "customer";
    if (status === "pending") return driver?.verification === "pending";
    if (status === "blocked") return Boolean(user.blockedAt);
    return true;
  });

  return (
    <div>
      <AdminTitle title="Nutzer & Codes" lead="Suche nach E-Mail, Name oder Lieferdank-Code – auch für Supportanfragen." />

      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="E-Mail, Name oder LD-Code" className="field flex-1" />
        {status && <input type="hidden" name="status" value={status} />}
        <button className="btn btn-primary">Suchen</button>
      </form>
      <div className="mb-8 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.id}
            href={`/admin/nutzer?${new URLSearchParams({ ...(q ? { q } : {}), ...(filter.id ? { status: filter.id } : {}) })}`}
            className={`chip ${status === filter.id ? "bg-brand text-white" : "bg-white text-ink-soft ring-1 ring-line"}`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Empty>Keine Treffer.</Empty>
      ) : (
        <ul className="space-y-3">
          {filtered.slice(0, 100).map(({ user, driver }) => (
            <li key={user.id} className="rounded-2xl border border-line bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-ink">{`${user.firstName} ${user.lastName}`.trim() || "—"}</span>
                <Badge>{user.role === "driver" ? "Lieferant" : user.role === "customer" ? "Kunde" : "Admin"}</Badge>
                {driver && <span className="chip bg-canvas font-mono text-ink-soft">{driver.code}</span>}
                {driver?.verification === "verified" && <Badge tone="blue">Abzeichen</Badge>}
                {driver?.verification === "pending" && <Badge tone="coral">Abzeichen angefragt</Badge>}
                {driver && !driver.active && <Badge>pausiert</Badge>}
                {driver?.payoutReady && <Badge tone="blue">Auszahlung bereit</Badge>}
                {user.blockedAt && <Badge tone="coral">gesperrt</Badge>}
              </div>
              <p className="mt-1.5 text-sm text-ink-soft">
                {user.email}
                {user.phone && ` · ${user.phone}`} · seit {formatDateTime(user.createdAt)}
              </p>
              {driver && (
                <p className="mt-1 text-sm text-ink-soft">
                  Öffentlich: „{driverPublicName(driver, user)}“
                  {driver.providerId && ` · ${providerLabel(driver.providerId)}${driver.providerVerified ? " (geprüft)" : ""}`}
                  {" · Guthaben "}
                  <span className="font-semibold text-ink">{formatEuro(balance.get(driver.id) ?? 0)}</span>
                  {" · "}
                  <Link href={`/danke/${driver.code}?vorschau=1`} className="font-semibold text-brand hover:underline">
                    Kundenseite
                  </Link>
                </p>
              )}
              {user.blockedReason && <p className="mt-1.5 text-sm font-medium text-coral-600">Sperrgrund: {user.blockedReason}</p>}
              {driver?.verification === "pending" && (
                <>
                  {notes.get(user.id)?.documentNote && (
                    <p className="mt-3 rounded-xl bg-canvas px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">{notes.get(user.id)?.documentNote}</p>
                  )}
                  <BadgeReview driverId={driver.id} />
                </>
              )}
              {user.role !== "admin" && (
                <UserControls
                  userId={user.id}
                  driverId={driver?.id ?? null}
                  blocked={Boolean(user.blockedAt)}
                  providerVerified={driver?.providerVerified ?? false}
                  hasProvider={Boolean(driver?.providerId)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
