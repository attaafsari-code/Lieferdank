import { requireDriver } from "@/server/guards";
import { getDriverStats } from "@/server/services/stats";
import { MilestoneList, PageTitle, SectionTitle, ThankYouList } from "@/components/dashboard-ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deine Danke" };

export default async function ThankYousPage() {
  const { driver } = await requireDriver();
  const stats = await getDriverStats(driver.id);

  return (
    <div className="space-y-12">
      <PageTitle
        title="Deine Danke"
        lead={`Insgesamt ${stats.total.thanks} Danke erhalten.`}
      />

      <section>
        <SectionTitle>Nachrichten</SectionTitle>
        <ThankYouList items={stats.recentThankYous} />
      </section>

      <section>
        <SectionTitle>Meilensteine</SectionTitle>
        <MilestoneList items={stats.milestones} />
      </section>

      <p className="text-sm leading-relaxed text-ink-soft">
        Kunden können bei Lieferdank ausschließlich Positives senden. Es gibt keine
        Bewertungen, keine Sterne und keine Beschwerden.
      </p>
    </div>
  );
}
