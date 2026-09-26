import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { AdminTitle, Badge, Empty, SectionHeading } from "../ui";

export const dynamic = "force-dynamic";

export default async function AdminSystem() {
  const db = getDb();
  const [events, actions] = await Promise.all([
    db.systemEvents.findMany({ orderBy: "createdAt", desc: true, limit: 100 }),
    db.adminActions.findMany({ orderBy: "createdAt", desc: true, limit: 100 }),
  ]);

  return (
    <div className="space-y-12">
      <AdminTitle title="System" lead="Fehlgeschlagene Zahlungen, Mails und Webhooks – und wer im Admin was getan hat." />

      <section>
        <SectionHeading>Fehlermeldungen & Ereignisse</SectionHeading>
        {events.length === 0 ? (
          <Empty>Keine Ereignisse. Alles ruhig.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {events.map((event) => (
              <li key={event.id} className="px-5 py-3.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={event.level === "error" ? "coral" : event.level === "warning" ? "gray" : "blue"}>{event.level}</Badge>
                  <span className="font-mono text-xs text-ink-faint">{event.source}</span>
                  <span className="font-semibold text-ink">{event.message}</span>
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  {formatDateTime(event.createdAt)}
                  {event.context && ` · ${JSON.stringify(event.context).slice(0, 240)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeading>Adminprotokoll</SectionHeading>
        {actions.length === 0 ? (
          <Empty>Noch keine Aktionen.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {actions.map((action) => (
              <li key={action.id} className="px-5 py-3.5 text-sm">
                <span className="font-semibold text-ink">{action.action}</span>{" "}
                <span className="text-ink-soft">
                  · {action.actorEmail} · {formatDateTime(action.createdAt)}
                  {action.reason && ` · ${action.reason}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
