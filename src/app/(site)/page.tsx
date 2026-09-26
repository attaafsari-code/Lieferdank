import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check, Heart } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { PLATFORM_GROSS_FEE_CENTS, TIP_OPTIONS_CENTS } from "@/lib/money";
import { formatEuro, formatEuroShort } from "@/lib/format";
import { canonicalBase } from "@/lib/site";
import { qrSvg } from "@/lib/qr";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  // Echter QR-Code auf der Beispielkarte: Er führt auf lieferdank.de.
  const demoQr = await qrSvg(canonicalBase());

  return (
    <>
      <Hero qr={demoQr} />
      <Steps />
      <CustomerSection />
      <Transparency />
      <Boundaries />
      <FinalCta />
    </>
  );
}

function Hero({ qr }: { qr: string }) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 h-[28rem] w-[40rem] -translate-x-1/2 rounded-full bg-brand-100/70 blur-3xl" />
        <div className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-coral-100/50 blur-3xl" />
      </div>

      <div className="container-page relative grid gap-14 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-24 lg:pb-28">
        <div>
          <span className="chip bg-white text-coral-600 shadow-xs ring-1 ring-coral-100">
            <Heart className="h-3.5 w-3.5" />
            Für Paketzusteller in Deutschland
          </span>

          <h1 className="mt-6 text-[2.75rem] leading-[1.05] font-extrabold text-brand-900 sm:text-6xl">
            Dein Einsatz verdient ein Danke.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
            Lieferdank gibt dir einen persönlichen Danke-Code. Deine Kunden sagen damit
            kostenlos Danke – oder geben freiwillig Trinkgeld. Ohne App, in wenigen
            Sekunden.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="btn btn-primary btn-lg">
              Kostenlos Danke-Code erstellen
              <ArrowRight className="h-[1.05rem] w-[1.05rem]" />
            </Link>
            <Link href="/so-funktionierts" className="btn btn-ghost btn-lg">
              So funktioniert&rsquo;s
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-soft">
            {["Kostenlos für Zusteller", "Keine App für Kunden", "Jederzeit kündbar"].map(
              (item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-brand" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <CardVisual qr={qr} />
      </div>
    </section>
  );
}

/** Vorschau der physischen Lieferdank-Karte. */
function CardVisual({ qr }: { qr: string }) {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden
        className="absolute -inset-4 rotate-[-4deg] rounded-[2.25rem] bg-gradient-to-br from-brand/10 via-transparent to-coral/15"
      />
      <div className="relative rounded-[1.75rem] border border-line bg-white p-8 text-center shadow-lg">
        <LogoMark className="mx-auto h-10 w-10" />

        <p className="mt-4 text-[1.0625rem] leading-snug font-extrabold text-brand-900">
          Möchtest du deinem Zusteller
          <br />
          Danke sagen? <span className="text-coral">❤</span>
        </p>

        <div className="mx-auto mt-6 w-40 rounded-2xl bg-white p-3 ring-1 ring-line">
          <div className="[&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>

        <p className="mt-5 text-lg font-bold text-ink">Max</p>
        <p className="text-sm text-ink-soft">unterwegs für DHL</p>

        <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-ink-faint">
          Scannen · keine App nötig
          <br />
          Danke sagen kostenlos · Trinkgeld freiwillig
        </p>
      </div>
    </div>
  );
}

function Steps() {
  const steps = [
    {
      title: "Registrieren",
      text: "Erstelle kostenlos dein Lieferdank-Profil. Dauert unter zwei Minuten.",
    },
    {
      title: "Danke-Code erhalten",
      text: "Dein persönlicher QR-Code – digital am Handy und als druckbare Karte.",
    },
    {
      title: "Danke bekommen",
      text: "Kunden scannen und senden dir ein Danke oder freiwilliges Trinkgeld.",
    },
  ];

  return (
    <section className="border-y border-line bg-white py-20 sm:py-24">
      <div className="container-page">
        <p className="eyebrow text-center">In drei Schritten</p>
        <h2 className="mt-3 text-center text-3xl font-extrabold text-brand-900 sm:text-4xl">
          Vom Konto zum ersten Danke
        </h2>

        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="card-flat">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-lg font-extrabold text-brand">
                {index + 1}
              </span>
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
            Sag deinem Zusteller Danke <span className="text-coral">❤</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Im Restaurant gibt es die Rechnung. Beim Friseur die Kasse. Beim Paket endet
            alles mit „Danke“ und einer geschlossenen Tür. Lieferdank schafft den Moment,
            der bisher fehlt.
          </p>

          <ul className="mt-8 space-y-3.5">
            {[
              "Kein Konto, keine App, keine Registrierung",
              "Danke sagen ist immer kostenlos",
              "Trinkgeld ist vollständig freiwillig",
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
        <div className="rounded-[2rem] bg-canvas px-5 py-7">
          <LogoMark className="mx-auto h-7 w-7" />
          <p className="mt-3 text-center text-[1.15rem] leading-tight font-extrabold text-brand-900">
            Sag deinem Zusteller Danke
          </p>

          <div className="mt-4 rounded-2xl border border-line bg-white px-4 py-3 text-center">
            <p className="text-lg font-extrabold text-ink">Max</p>
            <p className="mt-1 text-xs font-semibold text-brand">✓ Verifizierter Zusteller</p>
          </div>

          <div className="mt-4 rounded-xl bg-coral py-3.5 text-center text-[0.9375rem] font-semibold text-white shadow-coral">
            ❤ Kostenlos Danke sagen
          </div>

          <p className="mt-5 text-center text-[0.6rem] font-bold tracking-[0.14em] text-ink-faint uppercase">
            oder Trinkgeld geben
          </p>

          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {TIP_OPTIONS_CENTS.map((cents) => (
              <div
                key={cents}
                className="rounded-xl border-[1.5px] border-line bg-white py-2.5 text-center"
              >
                <span className="block text-base font-extrabold text-ink">
                  {formatEuroShort(cents)}
                </span>
                <span className="block text-[0.55rem] leading-tight text-ink-faint">
                  Max erhält
                  <br />
                  {formatEuro(cents - PLATFORM_GROSS_FEE_CENTS)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Transparency() {
  return (
    <section className="border-y border-line bg-white py-20 sm:py-24">
      <div className="container-page max-w-3xl">
        <p className="eyebrow text-center">Transparent</p>
        <h2 className="mt-3 text-center text-3xl font-extrabold text-brand-900 sm:text-4xl">
          Kein Kleingedrucktes
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-center text-lg leading-relaxed text-ink-soft">
          Der Kunde zahlt exakt den gewählten Betrag. Keine Servicegebühr obendrauf, keine
          Überraschung im Checkout.
        </p>

        <div className="card-lift mx-auto mt-12 max-w-lg !p-0">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="px-6 py-4 text-xs font-bold tracking-wide text-ink-faint uppercase">
                  Kunde zahlt
                </th>
                <th className="px-6 py-4 text-xs font-bold tracking-wide text-ink-faint uppercase">
                  Zusteller erhält
                </th>
                <th className="px-6 py-4 text-xs font-bold tracking-wide text-ink-faint uppercase">
                  Abwicklung
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {TIP_OPTIONS_CENTS.map((cents) => (
                <tr key={cents}>
                  <td className="px-6 py-4 text-lg font-extrabold text-ink">
                    {formatEuro(cents)}
                  </td>
                  <td className="px-6 py-4 text-lg font-extrabold text-coral">
                    {formatEuro(cents - PLATFORM_GROSS_FEE_CENTS)}
                  </td>
                  <td className="px-6 py-4 text-ink-soft">
                    {formatEuro(PLATFORM_GROSS_FEE_CENTS)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mx-auto mt-6 max-w-lg text-center text-sm leading-relaxed text-ink-soft">
          Die {formatEuro(PLATFORM_GROSS_FEE_CENTS)} je Trinkgeld decken Zahlungsabwicklung,
          Betrieb und Betrugsprävention. Der Rest gehört dem Zusteller.
        </p>
      </div>
    </section>
  );
}

function Boundaries() {
  const items = [
    {
      title: "Keine Bewertungen",
      text: "Lieferdank ist kein Bewertungsportal. Keine Sterne, keine Beschwerden, keine Ranglisten.",
    },
    {
      title: "Keine Überwachung",
      text: "Arbeitgeber bekommen keine Leistungsdaten. Dein Danke-Code gehört dir, nicht deinem Paketdienst.",
    },
    {
      title: "Kein Betteln",
      text: "Du bittest niemanden um Geld. Der Code ist sichtbar – der Kunde entscheidet freiwillig.",
    },
  ];

  return (
    <section className="py-20 sm:py-24">
      <div className="container-page">
        <h2 className="text-center text-3xl font-extrabold text-brand-900 sm:text-4xl">
          Wofür Lieferdank ausdrücklich nicht steht
        </h2>

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
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Hol dir deinen Danke-Code
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-white/75">
            Kostenlos, in unter zwei Minuten eingerichtet. Bitte beachte dabei die Regeln
            deines Arbeitgebers bzw. Auftraggebers.
          </p>
          <Link href="/register" className="btn btn-white btn-lg mt-9">
            Jetzt kostenlos starten
            <ArrowRight className="h-[1.05rem] w-[1.05rem]" />
          </Link>
        </div>
      </div>
    </section>
  );
}
