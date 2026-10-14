import { requireAdmin } from "@/server/guards";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { AdminTitle, Badge, Empty, SectionHeading } from "../ui";
import { openReports } from "@/server/services/moderation";
import { ResolveReport } from "./resolve-report";

export const dynamic = "force-dynamic";

export default async function AdminSystem() {
  await requireAdmin();
  const db = getDb();
  const [reports, events, actions] = await Promise.all([
    openReports(),
    db.systemEvents.findMany({ orderBy: "createdAt", desc: true, limit: 100 }),
    db.adminActions.findMany({ orderBy: "createdAt", desc: true, limit: 100 }),
  ]);

  return (
    <div className="space-y-12">
      <AdminTitle title="System" lead="Fehlgeschlagene Zahlungen, Mails und Webhooks – und wer im Admin was getan hat." />

      <section>
        <SectionHeading>Gemeldete Nachrichten</SectionHeading>
        {reports.length === 0 ? (
          <Empty>Keine offenen Meldungen.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5 text-sm">
                <div>
                  <p className="font-semibold text-ink">„{report.message}“</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {formatDateTime(report.createdAt)} · Zusteller {report.driverId.slice(0, 8)} · für den Zusteller bereits ausgeblendet
                  </p>
                </div>
                <ResolveReport reportId={report.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

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
