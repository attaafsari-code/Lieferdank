import Link from "next/link";
import { requireDriver } from "@/server/guards";
import { getDb } from "@/lib/db";
import { avatarUrl, driverPublicName } from "@/server/services/drivers";
import { initials } from "@/lib/names";
import { PageTitle, SectionTitle } from "@/components/dashboard-ui";
import { Download } from "@/components/icons";
import { ProfileForm } from "./profile-form";
import { PhotoUpload } from "./photo-upload";
import { VerificationForm } from "./verification-form";
import { ActiveToggle, DeleteAccount } from "./danger-zone";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profil" };

const BADGE_STATUS: Record<string, { text: string; tone: string }> = {
  unverified: { text: "Nicht angefragt", tone: "bg-canvas text-ink-soft" },
  pending: { text: "In Prüfung", tone: "bg-brand-50 text-brand" },
  verified: { text: "Bestätigt", tone: "bg-brand-50 text-brand" },
  rejected: { text: "Nicht bestätigt", tone: "bg-coral-50 text-coral-600" },
};

export default async function ProfilePage() {
  const { user, driver } = await requireDriver();
  const verification = await getDb().verifications.findOne({ userId: user.id });
  const name = driverPublicName(driver, user);
  const status = BADGE_STATUS[driver.verification] ?? BADGE_STATUS.unverified;

  return (
    <div className="space-y-12">
      <PageTitle title="Profil" lead="Du entscheidest, was Kunden von dir sehen. Adresse und Telefonnummer sind nie öffentlich." />

      <section>
        <SectionTitle>Profilfoto</SectionTitle>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-xs">
          <PhotoUpload name={name} initials={initials(name)} photoUrl={avatarUrl(driver)} photoPublic={driver.photoPublic} />
        </div>
      </section>

      <div className="rounded-2xl border border-line bg-white p-6 shadow-xs sm:p-7">
        <ProfileForm
          firstName={user.firstName}
          lastName={user.lastName}
          phone={user.phone}
          nameDisplay={driver.nameDisplay}
          customName={driver.customName}
          tagline={driver.tagline}
          bio={driver.bio}
          city={driver.city}
          notifyOnTip={driver.notifyOnTip}
        />
      </div>

      <section>
        <SectionTitle>Sichtbarkeit</SectionTitle>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-xs">
          <ActiveToggle active={driver.active} />
        </div>
      </section>

      <section id="abzeichen" className="scroll-mt-36">
        <SectionTitle>Vertrauensabzeichen (freiwillig)</SectionTitle>
        <div className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold text-ink">Status</span>
            <span className={`chip ${status.tone}`}>{status.text}</span>
          </div>
          <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
            Wenn wir deine Tätigkeit bestätigt haben, steht auf deiner Kundenseite „Verifiziert“. Das
            schafft Vertrauen – dein Code funktioniert aber auch ohne.
          </p>
          {driver.verification === "rejected" && verification?.reviewNote && (
            <p className="rounded-xl bg-coral-50 px-4 py-3 text-[0.9375rem] text-ink">Anmerkung: {verification.reviewNote}</p>
          )}
          {driver.verification === "verified" ? null : driver.verification === "pending" ? (
            <p className="rounded-xl bg-canvas px-4 py-3.5 text-sm text-ink-soft">Deine Anfrage liegt uns vor.</p>
          ) : (
            <VerificationForm existingNote={verification?.documentNote ?? null} />
          )}
        </div>
      </section>

      <section>
        <SectionTitle>Deine Daten</SectionTitle>
        <div className="space-y-5 rounded-2xl border border-line bg-white p-6 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <span>
              <span className="block font-semibold text-ink">Daten exportieren</span>
              <span className="mt-1 block text-[0.9375rem] text-ink-soft">Alles, was wir zu deinem Konto speichern.</span>
            </span>
            <a href="/api/datenexport" className="btn btn-ghost btn-sm shrink-0">
              <Download className="h-4 w-4" /> Laden
            </a>
          </div>
          <div className="flex flex-col items-start justify-between gap-4 border-t border-line pt-5 sm:flex-row">
            <span className="min-w-0 break-words">
              <span className="block font-semibold text-ink">Passwort ändern</span>
              <span className="mt-1 block text-[0.9375rem] text-ink-soft">
                Wir schicken dir einen Link an {user.email}. Für eine neue E-Mail-Adresse{" "}
                <Link href="/kontakt" className="font-semibold text-brand underline underline-offset-2">
                  schreib uns
                </Link>
                .
              </span>
            </span>
            <Link href="/passwort-vergessen" className="btn btn-ghost btn-sm shrink-0">
              Link anfordern
            </Link>
          </div>
          <div className="border-t border-line pt-5">
            <DeleteAccount />
          </div>
        </div>
      </section>

      <p className="text-sm leading-relaxed text-ink-soft">
        {user.email} · Bitte beachte die Regeln deines Arbeitgebers bzw. Auftraggebers, wenn du deine Karte
        während der Arbeit trägst.
      </p>
    </div>
  );
}
