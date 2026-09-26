import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { PageTitle, SectionTitle } from "@/components/dashboard-ui";
import { Download } from "@/components/icons";
import { ProfileForm } from "./profile-form";
import { VerificationForm } from "./verification-form";
import { ActiveToggle, DeleteAccount } from "./danger-zone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profil" };

const STATUS: Record<string, { text: string; tone: string }> = {
  unverified: { text: "Nicht angefragt", tone: "bg-canvas text-ink-soft" },
  pending: { text: "In Prüfung", tone: "bg-brand-50 text-brand" },
  verified: { text: "Bestätigt", tone: "bg-brand-50 text-brand" },
  rejected: { text: "Nicht bestätigt", tone: "bg-coral-50 text-coral-600" },
};

export default async function ProfilePage() {
  const session = await getSession();
  if (!session?.driver) redirect("/login");

  const driver = session.driver;
  const verification = await getStore().getVerificationByUserId(session.user.id);
  const status = STATUS[driver.verification] ?? STATUS.unverified;

  return (
    <div className="space-y-12">
      <PageTitle title="Profil" lead={`${session.user.name} · ${session.user.email}`} />

      <section>
        <SectionTitle>Deine Angaben</SectionTitle>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-xs">
          <ProfileForm
            displayName={driver.displayName}
            providerId={driver.providerId}
            city={driver.city}
          />
        </div>
      </section>

      <section id="abzeichen" className="scroll-mt-36">
        <SectionTitle>Vertrauensabzeichen</SectionTitle>
        <div className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold text-ink">Status</span>
            <span className={`chip ${status.tone}`}>{status.text}</span>
          </div>

          <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
            Freiwillig: Wenn wir deine Zustellertätigkeit bestätigt haben, steht auf deiner
            Kundenseite „✓ Verifizierter Zusteller“. Das schafft Vertrauen – dein Danke-Code
            und deine Auszahlungen funktionieren aber auch ohne.
          </p>

          {driver.verification === "rejected" && verification?.reviewNote && (
            <p className="rounded-xl bg-coral-50 px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">
              Anmerkung der Prüfung: {verification.reviewNote}
            </p>
          )}

          {driver.verification === "verified" ? (
            <p className="rounded-xl bg-brand-50 px-4 py-3.5 text-sm font-semibold text-brand-900">
              Alles erledigt. Auf deiner Kundenseite steht „✓ Verifizierter Zusteller“.
            </p>
          ) : driver.verification === "pending" ? (
            <p className="rounded-xl bg-canvas px-4 py-3.5 text-sm text-ink-soft">
              Deine Anfrage liegt uns vor. Wir melden uns per E-Mail.
            </p>
          ) : (
            <VerificationForm existingNote={verification?.documentNote ?? null} />
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Sichtbarkeit</SectionTitle>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-xs">
          <ActiveToggle active={driver.active} />
        </div>
      </section>

      <section>
        <SectionTitle>Deine Daten</SectionTitle>
        <div className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <span>
              <span className="block font-semibold text-ink">Daten exportieren</span>
              <span className="mt-1 block text-[0.9375rem] leading-relaxed text-ink-soft">
                Alle zu deinem Konto gespeicherten Daten als JSON-Datei.
              </span>
            </span>
            <a href="/api/datenexport" className="btn btn-ghost btn-sm shrink-0">
              <Download className="h-4 w-4" />
              Laden
            </a>
          </div>

          <div className="border-t border-line pt-5">
            <DeleteAccount />
          </div>
        </div>
      </section>

      <p className="text-sm leading-relaxed text-ink-soft">
        Hinweis: Bitte beachte die Regeln deines Arbeitgebers bzw. Auftraggebers, wenn du
        deine Lieferdank-Karte während der Arbeit sichtbar trägst.
      </p>
    </div>
  );
}
