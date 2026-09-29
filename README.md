# Lieferdank

**Dein Danke kommt an.**

Lieferdank gibt Paketzustellern einen persönlichen
Danke-Code. Kunden scannen ihn und sagen kostenlos Danke oder geben ein Trinkgeld –
ohne App, ohne Konto.

- **Web-App**: Next.js 16, TypeScript, Tailwind CSS 4
- **Daten**: Supabase (Postgres + Storage), lokal eine JSON-Testdatenbank
- **Zahlungen**: Stripe Connect + Checkout (Karte, Apple Pay, Google Pay; PayPal später)
- **Mail**: Resend
- **PWA**: installierbar auf iOS und Android, vorbereitet für native Apps

---

## Schnellstart

```bash
npm install
npm run seed
npm run dev
```

Dann **http://localhost:3000** öffnen. Ohne jede Konfiguration: Zahlungen werden simuliert,
Daten liegen in `data/db.json`; E-Mails werden nicht versendet und ihr Inhalt wird nicht protokolliert.

### Demo-Zugänge (nur nach lokalem `npm run seed`, nie für Produktion)

| Rolle     | E-Mail                | Passwort           | Startseite            |
| --------- | --------------------- | ------------------ | --------------------- |
| Lieferant | `max@lieferdank.de`   | `lieferdank-demo`  | `/dashboard`          |
| Kundin    | `kunde@lieferdank.de` | `lieferdank-demo`  | `/konto`              |
| Admin     | `admin@lieferdank.de` | `lieferdank-admin` | `/admin`              |

Kundenseiten zum Ausprobieren:

| Code        | Zeigt                                               |
| ----------- | --------------------------------------------------- |
| `LD-DEMO01` | Max · DHL · verifiziert · mit Text und Beschreibung |
| `LD-DEMO02` | „Ayşe Y.“ · Lieferando · Initialen statt Nachname   |
| `LD-DEMO03` | „Herr Krüger“ → „Sag **Herrn** Krüger Danke“        |

> `npm run seed` setzt `data/db.json` zurück. Den Dev-Server danach neu starten.

### Mit dem Handy testen

Ohne `NEXT_PUBLIC_BASE_URL` schreibt die App die **WLAN-Adresse des Rechners** in die
QR-Codes (z. B. `http://192.168.178.73:3000`). Handy ins selbe WLAN, Karte unter
`/dashboard/karte` öffnen, QR-Code mit der Kamera scannen – fertig. Die Adresse steht auch
im Dashboard.

---

## Was die App kann

**Kunde** – QR scannen → Lieferant sehen → kostenlos Danke oder 2 / 3 / 5 € → Nachricht →
optional Lieferant speichern. Nie Pflicht: Konto, App oder Dateneingabe.

**Lieferant** – registrieren und sofort loslegen (keine Verifizierungspflicht) · öffentlichen
Namen wählen (Vorname, „Max M.“, voller Name, „Herr Müller“ …) · Foto öffentlich oder nur
privat · Karte gestalten (3 Designs, eigener Text) · Export als PNG/SVG, Druckbogen,
Plastikkarte nur bei aktivierter Bezahlfunktion bestellen · Dashboard mit Tag/Woche/Monat, Trinkgeldanteil vor Stripe-Kosten, Meilensteinen ·
Auszahlungskonto über Stripe (dort passiert die gesetzlich nötige Identitätsprüfung).

**Kunde mit Konto (optional)** – „Meine Lieferanten“, Verlauf, erneut Danke sagen.

**Admin** – Kennzahlen zur Application Fee vor Betriebskosten · Nutzer, Codes, Sperren · Transaktionen ·
historische Auszahlungen · Kartenbestellungen mit Versandstatus · Fehlermeldungen und Adminprotokoll.

### Geldlogik

Der Kunde zahlt **exakt** den gewählten Betrag. Trinkgelder sind Stripe-Connect-Direct-Charges
auf dem Standard-Konto des Zustellers; Stripe übernimmt KYC und normale Auszahlungen.
Lieferdank hält kein Fahrergeld und startet keine eigenen Transfers.

| Kunde zahlt | Application Fee | Fahreranteil vor Stripe-Kosten |
| ----------- | --------------- | ------------------------------ |
| 2,00 €      | 0,50 €          | 1,50 €                         |
| 3,00 €      | 0,60 €          | 2,40 €                         |
| 5,00 €      | 1,00 €          | 4,00 €                         |

Stripe belastet das Connected Account mit seinen Processing- und gegebenenfalls
Auszahlungskosten. Der tatsächliche Bankbetrag kann deshalb niedriger sein.
Historische Kostenspalten im Schema sind kein Nachweis des Stripe-Nettoerlöses.
Details: [DATABASE.md](DATABASE.md).

Die Aufteilung ist reine Backend-Logik. Kunden sehen nur die Beträge 2 € / 3 € / 5 € und
einen neutralen Hinweis, dass Zahlungs- und Plattformkosten abgezogen werden. Die genauen
Zahlen stehen nur auf Zustellerseiten (Dashboard, `/fahrer`, FAQ für Zusteller, AGB §4).

---

## Projektstruktur

```
src/
  lib/          Reine Fachlogik ohne Server-Abhängigkeit – in einer App wiederverwendbar
                money, names, base-url, pricing, milestone-rules, card/svg, db/types
  server/       Alles, was nur auf dem Server läuft
    services/   Geschäftslogik (Danke, Trinkgeld, Karten, Favoriten, Auszahlung …)
    actions/    Server Actions der Web-App – dünne Hülle um die Services
    api/        Rahmen für die REST-API (Auth, Fehler, Rate Limit)
    payments/   Payment-Layer: demo | stripe (austauschbar)
  app/
    (site)/     Öffentliche Seiten, Login, Registrierung, Kundenkonto
    danke/      Kundenseite nach dem QR-Scan
    dashboard/  Lieferanten-Bereich
    admin/      Adminbereich
    api/v1/     REST-API für die spätere iOS-/Android-App
tests/          Vitest: Geld, Namen, QR-End-to-End, Abläufe, API, Schema-Konsistenz
supabase/       schema.sql
scripts/        seed.mjs, icloud-exclude.mjs
```

Web-App und künftige Apps teilen sich die Services. Die Web-App ruft sie über Server
Actions auf, Apps über `/api/v1` – siehe [APP_ROADMAP.md](APP_ROADMAP.md).

---

## Befehle

| Befehl              | Zweck                                              |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Entwicklungsserver                                 |
| `npm run build`     | Produktionsbuild                                   |
| `npm start`         | Produktionsserver (braucht `AUTH_SECRET`)          |
| `npm test`          | Alle Tests (102)                                   |
| `npm run typecheck` | TypeScript                                         |
| `npm run check`     | TypeScript + Tests                                 |
| `npm run seed`      | Demo-Daten neu erzeugen                            |

### Tests

- **Geld**: Aufteilung 2/3/5 €, Mindestbetrag, cent-genaue Gebührenverteilung
- **QR-End-to-End**: Code wird erzeugt und wie von einer Kamera zurückgelesen, auch in
  Kartengröße; in Produktion nie localhost
- **Abläufe**: Registrierung → Danke → Trinkgeld → Auszahlung, Doppelbuchung, Erstattung,
  Passwort-Reset, Favoriten, Kartenbestellung
- **API**: öffentliche und geschützte Endpunkte, Rollen, CSRF-Schutz
- **Schema-Konsistenz**: TypeScript-Typen, `supabase/schema.sql` und Seed-Skript müssen
  exakt dieselben Felder haben

---

## Hinweis: Projekt auf dem Schreibtisch mit iCloud

Wird der Schreibtisch über iCloud Drive synchronisiert, blockiert iCloud Dateizugriffe,
während es Tausende Dateien hochlädt – Builds hängen dann minutenlang. Der Projektordner ist
deshalb per `com.apple.fileprovider.ignore#P` vom Sync ausgenommen; `npm install` setzt das
für `node_modules` und `.next` automatisch (`scripts/icloud-exclude.mjs`). Die Sicherung
läuft über GitHub.

---

## Weiter

- [DEPLOYMENT.md](DEPLOYMENT.md) – GitHub, Vercel, Domain, Supabase, Stripe, Resend
- [DATABASE.md](DATABASE.md) – Tabellen, Geldfelder, Sicherheit
- [APP_ROADMAP.md](APP_ROADMAP.md) – Weg zur iOS- und Android-App
- [DECISIONS.md](DECISIONS.md) – Produktentscheidungen mit Begründung und Risiko
