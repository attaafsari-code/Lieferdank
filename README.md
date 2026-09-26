# Lieferdank

**Dein Danke kommt an.**

Lieferdank gibt Paketzustellern einen persönlichen Danke-Code. Kunden scannen ihn und
können kostenlos Danke sagen oder freiwillig Trinkgeld geben – ohne App, ohne
Registrierung.

---

## Schnellstart

```bash
npm install
npm run seed      # Demo-Daten anlegen (data/db.json)
npm run dev       # http://localhost:3000
```

Kein Setup nötig: keine Datenbank, kein Stripe-Konto, kein API-Key. Zahlungen werden
simuliert, es fließt kein echtes Geld.

### Demo-Zugänge

| Rolle     | E-Mail                | Passwort           |
| --------- | --------------------- | ------------------ |
| Zusteller | `max@lieferdank.de`   | `lieferdank-demo`  |
| Admin     | `admin@lieferdank.de` | `lieferdank-admin` |

Kundenseite zum Ausprobieren: `/danke/LD-DEMO01`

> `npm run seed` überschreibt `data/db.json`. Ein laufender Dev-Server muss danach neu
> gestartet werden, weil der Testspeicher die Datei beim Start einliest.

### QR-Code am Handy testen

In der Entwicklung setzt die App die Basis-URL automatisch auf die LAN-Adresse dieses
Rechners (z. B. `http://192.168.1.42:3000`). Ein Handy im selben WLAN kann den QR-Code
aus dem Dashboard damit direkt scannen – ohne Tunnel, ohne Deployment.

Erscheint im Dashboard trotzdem ein roter Hinweis auf eine lokale Adresse, setze
`NEXT_PUBLIC_BASE_URL` explizit.

---

## Der Kernprozess

1. `/register` – Konto anlegen, Danke-Code wird sofort erzeugt
2. `/dashboard/code` – QR-Code ansehen, als PNG oder SVG laden
3. `/dashboard/karte` – 10 Karten pro A4-Seite drucken (85,6 × 54 mm)
4. `/danke/<CODE>` – was der Kunde nach dem Scan sieht
5. Kostenlos Danke oder 2 / 3 / 5 € → Zahlung → Erfolgsseite mit Nachricht
6. `/dashboard` – Danke, Guthaben und Meilensteine
7. `/admin` – Abzeichen-Anfragen, Transaktionen, Plattformmarge

---

## Architektur

```
src/
  app/
    (site)/            Öffentliche Seiten, Login, Registrierung, Passwort-Reset, Legal
    danke/[code]/      Kundenseite nach dem QR-Scan (ablenkungsfreies Layout)
    zahlung/[tipId]/   Simulierte Bezahlmaske (nur im Testmodus erreichbar)
    dashboard/         Zusteller-Dashboard
    admin/             Adminbereich
    api/               Datenexport (DSGVO), Stripe-Webhook
  lib/
    money.ts           Geldlogik und Gebührenaufteilung – die Wahrheit über Beträge
    site.ts            Basis-URL für QR-Codes, canonical-Adresse
    db/                Store-Interface + Adapter (memory | supabase)
    payments/          PaymentProvider-Interface + Adapter (demo | stripe)
    auth.ts            Session-Cookie (JWT), Passwort-Hashing (scrypt)
    mail.ts            E-Mail-Versand für den Passwort-Reset
    stats.ts           Kennzahlen für Dashboard und Admin
```

### Zwei austauschbare Schichten

**Datenbank** (`LIEFERDANK_DB`)

- `memory` – Testbetrieb, persistiert nach `data/db.json`
- `supabase` – Postgres, Schema in [`supabase/schema.sql`](supabase/schema.sql)

**Zahlungen** (`PAYMENT_PROVIDER`)

- `demo` – simuliert, kein echtes Geld
- `stripe` – Stripe Connect mit Destination Charges

Die Geschäftslogik importiert nie direkt Stripe oder Supabase. Ein Providerwechsel
(Adyen, Mangopay, Mollie …) bedeutet: ein neues Modul in `src/lib/payments/`, das
`PaymentProvider` implementiert – sonst nichts.

---

## Geldlogik

Der Kunde zahlt **exakt** den gewählten Betrag. Keine Servicegebühr im Checkout.

| Kunde zahlt | Zusteller erhält | Plattform brutto |
| ----------- | ---------------- | ---------------- |
| 2,00 €      | 1,50 €           | 0,50 €           |
| 3,00 €      | 2,50 €           | 0,50 €           |
| 5,00 €      | 4,50 €           | 0,50 €           |

Frei wählbare Beträge sind von 2 € bis 50 € möglich. Unter 2 € gibt es bewusst nichts:
Bei 1 € wäre die feste Gebühr die Hälfte des Trinkgelds.

Die 0,50 € sind **nicht** der Gewinn. Jede Transaktion speichert getrennt:
`gross_cents`, `driver_cents`, `platform_gross_fee_cents`,
`payment_provider_fee_cents`, `platform_net_revenue_cents`.

Netto bleiben je Transaktion **0,17 € bis 0,22 €** (2 € → 0,22 €, 3 € → 0,20 €,
5 € → 0,17 €). Payment-Kosten sind eine Kalkulation (Default 1,5 % + 0,25 € = Stripe DE
Karten, über `PAYMENT_FEE_PERCENT` / `PAYMENT_FEE_FIXED_CENTS` anpassbar); für die
Buchhaltung zählen die echten Abrechnungen des Zahlungsdienstleisters.

---

## Registrierung und Verifizierung

Es gibt **keine** Verifizierungspflicht. Wer sich registriert, hat sofort einen
funktionierenden Danke-Code und kann Danke und Trinkgeld empfangen. Die Angabe des
Zustelldienstes ist optional und wird nicht geprüft (auf der Kundenseite steht dann
„eigene Angabe“).

Zwei freiwillige Stufen darüber:

- **Vertrauensabzeichen** – ein Mensch bestätigt die Zustellertätigkeit im Adminbereich.
  Danach steht auf der Kundenseite „✓ Verifizierter Zusteller“. Rein optional.
- **Auszahlungskonto** – hier prüft der Zahlungsdienstleister die Identität (KYC).
  Das ist für Auszahlungen gesetzlich vorgeschrieben und der einzige harte Schritt.

---

## Sicherheit

- Passwörter als scrypt-Hash, Session als signiertes HttpOnly-Cookie
- Sessions sind an eine Token-Version gebunden: Ein Passwort-Reset meldet alle anderen
  Geräte sofort ab
- Passwort-Reset-Token nur als SHA-256-Hash gespeichert, eine Stunde gültig, einmal
  verwendbar
- Rate Limiting auf Login, Registrierung, Reset, Danke und Trinkgeld
- Zahlungsbestätigung ausschließlich über den signierten Stripe-Webhook
- Doppelbuchung ausgeschlossen (Idempotenz im Webhook + Unique-Constraint)
- Adminaktionen werden protokolliert
- Sicherheits-Header inkl. HSTS in `next.config.ts`
- Schrift selbst gehostet – keine Nutzer-IP geht an Google
- Datenexport und Kontolöschung im Zusteller-Profil (DSGVO)

`AUTH_SECRET` fehlt in Produktion → roter Warnbalken und Anmeldungen schlagen fehl.

---

## Deployment

Vollständige Anleitung: [`DEPLOYMENT.md`](DEPLOYMENT.md).

Kurzfassung für `https://lieferdank.de`:

1. Supabase-Projekt anlegen, `supabase/schema.sql` ausführen
2. Auf Vercel deployen, Domain verbinden (`www` leitet automatisch weiter)
3. Umgebungsvariablen setzen – vor allem `NEXT_PUBLIC_BASE_URL=https://lieferdank.de`
4. Stripe Connect verbinden, Webhook auf `/api/webhooks/stripe`
5. Adminrolle in der Datenbank setzen

---

## Offen vor dem öffentlichen Start

- [ ] Rechtstexte (Impressum, Datenschutz, AGB) sind Entwürfe und müssen geprüft werden
- [ ] Supabase-Projekt anlegen und Schema ausrollen
- [ ] Stripe-Konto mit Connect freischalten
- [ ] `RESEND_API_KEY` setzen, sonst verschickt „Passwort vergessen“ keine E-Mail
- [ ] Auszahlungslauf automatisieren (aktuell markiert der Admin manuell)
- [ ] Fehler-Monitoring (Sentry o. ä.) anbinden

---

## Skripte

| Befehl              | Zweck                   |
| ------------------- | ----------------------- |
| `npm run dev`       | Entwicklungsserver      |
| `npm run build`     | Produktionsbuild        |
| `npm run start`     | Produktionsserver       |
| `npm run typecheck` | TypeScript prüfen       |
| `npm run seed`      | Demo-Daten neu erzeugen |
