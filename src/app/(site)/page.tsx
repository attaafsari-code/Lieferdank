import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check, Heart } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { TIP_OPTIONS_CENTS } from "@/lib/money";
import { formatEuroShort } from "@/lib/format";
import { renderCardSvg } from "@/lib/card/svg";
import { canonicalBase } from "@/server/site";
import { qrSvg } from "@/server/qr";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  // Echte Karte mit echtem QR-Code – er führt auf lieferdank.de.
  const qr = await qrSvg(canonicalBase());
  const card = renderCardSvg({
    layout: "classic",
    headline: "Danke für deine Wertschätzung ❤",
    publicName: "Max",
    providerLabel: "DHL",
    code: "LD-DEMO01",
    qrSvg: qr,
    avatar: null,
    idPrefix: "hero",
  });

  return (
    <>
      <Hero card={card} />
      <Steps />
      <CustomerSection />
      <Transparency />
      <Boundaries />
      <FinalCta />
    </>
  );
}

function Hero({ card }: { card: string }) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 h-[28rem] w-[40rem] -translate-x-1/2 rounded-full bg-brand-100/70 blur-3xl" />
        <div className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-coral-100/50 blur-3xl" />
      </div>

      <div className="container-page relative grid gap-14 pt-14 pb-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-24 lg:pb-28">
        <div>
          <p className="text-[2.1rem] leading-none font-extrabold tracking-[-0.04em] sm:text-[2.5rem]">
            <span className="text-brand-900">Liefer</span>
            <span className="text-coral">dank</span>
          </p>
          <h1 className="mt-4 text-[2.75rem] leading-[1.05] font-extrabold text-brand-900 sm:text-6xl">
            Dein Danke kommt an.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            Sag deinem Zusteller einfach Danke – kostenlos oder mit einem kleinen Trinkgeld. QR-Code scannen,
            fertig. Ohne App, ohne Konto.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="btn btn-primary btn-lg">
              Als Lieferant starten
              <ArrowRight className="h-[1.05rem] w-[1.05rem]" />
            </Link>
            <Link href="/so-funktionierts" className="btn btn-ghost btn-lg">
              So funktioniert&rsquo;s
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-soft">
            {["Für Paket-, Essens- und Kurierfahrer", "Kostenlos für Lieferanten", "Keine App für Kunden"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-brand" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div aria-hidden className="absolute -inset-6 rotate-[-5deg] rounded-[2.5rem] bg-gradient-to-br from-brand/10 via-transparent to-coral/15" />
          <div
            className="relative rotate-[-2deg] overflow-hidden rounded-[1.1rem] shadow-lg [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: card }}
          />
          <p className="relative mt-5 text-center text-sm text-ink-soft">Die persönliche Lieferdank-Karte – echt scannbar.</p>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  const steps = [
    { title: "Profil anlegen", text: "Kostenlos registrieren, Namen und Foto festlegen – du entscheidest, was Kunden sehen." },
    { title: "Karte gestalten", text: "Eigener Text, eigenes Design. Als Bild am Handy, zum Ausdrucken oder als Plastikkarte." },
    { title: "Danke bekommen", text: "Kunden scannen und senden dir ein Danke oder ein freiwilliges Trinkgeld." },
  ];

  return (
    <section className="border-y border-line bg-white py-20 sm:py-24">
      <div className="container-page">
        <p className="eyebrow text-center">Für Lieferanten</p>
        <h2 className="mt-3 text-center text-3xl font-extrabold text-brand-900 sm:text-4xl">In drei Schritten zum ersten Danke</h2>
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="card-flat">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-lg font-extrabold text-brand">{index + 1}</span>
              <h3 className="mt-5 text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CustomerSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-page grid gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="eyebrow">Für Kunden</p>
          <h2 className="mt-3 text-3xl font-extrabold text-brand-900 sm:text-4xl">
            Sag Danke <span className="text-coral">❤</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Im Restaurant gibt es die Rechnung. Beim Friseur die Kasse. An der Haustür endet alles mit „Danke“
            und einer geschlossenen Tür. Lieferdank schafft den Moment, der bisher fehlt.
          </p>
          <ul className="mt-8 space-y-3.5">
            {[
              "Kein Konto, keine App, keine Daten eingeben",
              "Danke sagen ist immer kostenlos",
              "Trinkgeld mit Apple Pay, Google Pay, PayPal oder Karte",
              "Du zahlst genau den Betrag, den du auswählst",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-ink">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
                  <Check className="h-3 w-3" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-ink-soft">
            Lieferanten wiederfinden?{" "}
            <Link href="/konto/registrieren" className="font-semibold text-brand hover:underline">
              Kostenloses Kundenkonto
            </Link>{" "}
            – freiwillig.
          </p>
        </div>
        <PhoneMock />
      </div>
    </section>
  );
}

function PhoneMock() {
  return (
    <div className="mx-auto w-full max-w-[19.5rem]">
      <div className="rounded-[2.75rem] border-[11px] border-brand-900 bg-canvas p-1 shadow-lg">
        <div className="flex flex-col items-center rounded-[2rem] bg-canvas px-5 py-7">
          <LogoMark className="h-6 w-6" />
          <div className="mt-4">
            <Avatar name="Max" initials="M" photoUrl={null} size="md" />
          </div>
          <p className="mt-3 text-center text-[1.2rem] leading-tight font-extrabold text-brand-900">
            Sag Max Danke <span className="text-coral">❤</span>
          </p>
          <p className="mt-1 text-xs text-ink-soft">unterwegs für DHL</p>
          <div className="mt-4 w-full rounded-xl bg-coral py-3.5 text-center text-[0.9375rem] font-semibold text-white shadow-coral">
            ❤ Kostenlos Danke sagen
          </div>
          <p className="mt-5 text-center text-[0.6rem] font-bold tracking-[0.14em] text-ink-faint uppercase">oder Trinkgeld geben</p>
          <div className="mt-2.5 grid w-full grid-cols-3 gap-2">
            {TIP_OPTIONS_CENTS.map((cents) => (
              <div key={cents} className="rounded-xl border-[1.5px] border-line bg-white py-3 text-center">
                <span className="block text-base font-extrabold text-ink">{formatEuroShort(cents)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Transparency() {
  const promises = [
    { title: "Exakt dein Betrag", text: "Du zahlst genau den Betrag, den du auswählst." },
    { title: "Nichts obendrauf", text: "Keine Servicegebühr, kein Abo, keine versteckten Zusatzkosten." },
    { title: "Ohne Konto", text: "Kein Login, keine App, keine Registrierung. Scannen und fertig." },
  ];
  return (
    <section className="border-y border-line bg-white py-20 sm:py-24">
      <div className="container-page max-w-4xl">
        <p className="eyebrow text-center">Transparent</p>
        <h2 className="mt-3 text-center text-3xl font-extrabold text-brand-900 sm:text-4xl">Kein Kleingedrucktes</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {promises.map((item) => (
            <div key={item.title} className="card-lift">
              <Check className="h-5 w-5 text-brand" />
              <h3 className="mt-3 text-lg font-extrabold text-ink">{item.title}</h3>
              <p className="mt-1.5 leading-relaxed text-ink-soft">{item.text}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-lg text-center text-sm leading-relaxed text-ink-faint">
          Vom gewählten Betrag werden Zahlungs- und Plattformkosten abgezogen.{" "}
          <Link href="/so-funktionierts#geld" className="underline underline-offset-2 transition hover:text-brand">
            Mehr erfahren
          </Link>
        </p>
      </div>
    </section>
  );
}

function Boundaries() {
  const items = [
    { title: "Keine Bewertungen", text: "Kein Bewertungsportal. Keine Sterne, keine Beschwerden, keine Ranglisten." },
    { title: "Keine Überwachung", text: "Arbeitgeber bekommen keine Leistungsdaten. Dein Code gehört dir, nicht deinem Lieferdienst." },
    { title: "Kein Betteln", text: "Niemand muss um Geld bitten. Der Code ist sichtbar – der Kunde entscheidet freiwillig." },
  ];
  return (
    <section className="py-20 sm:py-24">
      <div className="container-page">
        <h2 className="text-center text-3xl font-extrabold text-brand-900 sm:text-4xl">Wofür Lieferdank nicht steht</h2>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.title} className="card-flat">
              <h3 className="text-lg font-bold text-ink">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-soft">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="container-page pb-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-brand-900 px-6 py-16 text-center sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand/40 blur-3xl" />
          <div className="absolute -bottom-24 right-8 h-56 w-56 rounded-full bg-coral/25 blur-3xl" />
        </div>
        <div className="relative">
          <Heart className="mx-auto h-8 w-8 text-coral" />
          <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">Hol dir deinen Danke-Code</h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-white/75">
            Kostenlos, in unter zwei Minuten eingerichtet. Bitte beachte die Regeln deines Arbeitgebers bzw.
            Auftraggebers.
          </p>
          <Link href="/register" className="btn btn-white btn-lg mt-9">
            Als Lieferant starten
            <ArrowRight className="h-[1.05rem] w-[1.05rem]" />
          </Link>
        </div>
      </div>
    </section>
  );
}
