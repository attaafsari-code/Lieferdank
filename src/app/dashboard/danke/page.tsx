import Link from "next/link";
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
        <ThankYouList items={stats.recentThankYous} removable />
      </section>

      <section>
        <SectionTitle>Meilensteine</SectionTitle>
        <MilestoneList items={stats.milestones} />
      </section>

      <p className="text-sm leading-relaxed text-ink-soft">
        Kunden senden dir ein Danke, ein Trinkgeld und optional eine kurze Nachricht. Es gibt keine
        Bewertungen, keine Sterne und keine Beschwerden. Eine unpassende Nachricht kannst du hier selbst entfernen.
        Ist sie beleidigend oder rechtswidrig,{" "}
        <Link href="/kontakt?anliegen=meldung&ort=Nachricht%20im%20Dashboard" className="font-semibold text-brand underline underline-offset-2">
          melde sie uns
        </Link>{" "}
        bitte vorher.
      </p>
    </div>
  );
}
