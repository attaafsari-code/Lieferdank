# Datenbank

Lieferdank läuft in Produktion auf **Supabase (PostgreSQL + Storage)**. Lokal und in Tests
ersetzt eine JSON-Datei (`data/db.json`) die Datenbank – mit exakt derselben Schnittstelle.

- Schema: [`supabase/schema.sql`](supabase/schema.sql)
- Typen: [`src/lib/db/types.ts`](src/lib/db/types.ts)
- Adapter: [`src/lib/db/supabase.ts`](src/lib/db/supabase.ts) und [`src/lib/db/memory.ts`](src/lib/db/memory.ts)

`tests/schema.test.ts` prüft bei jedem Testlauf, dass Typen, SQL-Schema und Seed-Daten
dieselben Felder haben. Wer eine Spalte ergänzt, muss alle drei anpassen – sonst schlägt
der Test fehl, nicht die Produktion.

---

## Konventionen

| Regel               | Umsetzung                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| Namen               | Code: `camelCase` · Postgres: `snake_case` · der Adapter übersetzt       |
| IDs                 | UUID v4, im Code erzeugt (`crypto.randomUUID()`)                          |
| Geld                | Integer in **Cent**, Spalten enden auf `_cents`. Niemals Fließkomma       |
| Zeit                | `timestamptz`, im Code ISO-8601 in UTC                                    |
| E-Mail              | immer kleingeschrieben (per `check`-Constraint erzwungen)                |
| Lieferdank-Code     | immer großgeschrieben, z. B. `LD-84K2P7WQ9A`; ohne verwechselbare Zeichen      |
| Status              | Text mit `check`-Constraint statt Enum-Typ – leichter zu erweitern        |

---

## Tabellen

### Konten

| Tabelle             | Zweck                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| `users`             | Alle Konten: Lieferant, Kunde, Admin. Passwort als scrypt-Hash, `token_version` für Session-Widerruf, `email_verified_at` nach bestätigtem E-Mail-Link |
| `driver_profiles`   | Öffentliches Profil eines Lieferanten: Code, Namensanzeige, Foto, Lieferdienst, Texte, Auszahlungskonto |
| `customer_profiles` | Optionales Kundenkonto                                                   |
| `verifications`     | Freiwilliges Vertrauensabzeichen                                         |
| `password_resets`   | Einmal-Token (nur SHA-256-Hash), 60 Minuten gültig                       |

**Was öffentlich ist:** Aus `driver_profiles` + `users` wird für Kunden ausschließlich der
gewählte Anzeigename, ggf. Foto, Lieferdienst, Kurztext und Beschreibung gezeigt
(`toPublicDriver()` in `src/server/services/drivers.ts`). E-Mail, Telefon, Stadt und Nachname
(sofern nicht gewählt) verlassen nie den Server.

**Namensanzeige** (`name_display`): `first` · `first_initial` · `full` · `last` · `custom`.
Der Code in `driver_profiles.code` ändert sich dadurch nie.

### Geld

Neue Trinkgelder werden als **Direct Charge auf dem Stripe-Standard-Konto des Zustellers**
angelegt. Stripe belastet dieses Konto mit Processing-/gegebenenfalls Payout-Kosten,
führt KYC und reguläre Auszahlungen aus. Lieferdank erhält nur die Application Fee.
Es gibt keinen Platform-Hold, keine Lieferdank-Wallet und keine eigene Auszahlung.
`payouts` bleibt nur für historische Datensätze lesbar; neue Zeilen entstehen nicht.

| Kundenzahlung | Application Fee | Fahreranteil vor Stripe-Kosten |
| ---: | ---: | ---: |
| 200 Cent | 50 Cent | 150 Cent |
| 300 Cent | 60 Cent | 240 Cent |
| 500 Cent | 100 Cent | 400 Cent |

`tips.destination_account_id` enthält das Connect-Konto, auf dem die Direct Charge
angelegt wurde. Die Datenbank-Constraint `tips_direct_charge_model` erzwingt Zielkonto
und genau diese drei Aufteilungen. `driver_cents` ist **kein Bankguthaben** und keine
Zusage des Auszahlungsbetrags: Stripe zieht seine eigenen Gebühren separat ab.
`payment_provider_fee_cents`/`payout_fee_cents` bleiben aus historischen Gründen im
Schema, sind für neue Direct Charges aus Lieferdank-Sicht null. Die tatsächliche
vorgesehene Application Fee vor eigenen Betriebskosten steht in
`platform_gross_fee_cents`. Der tatsächliche Geldeingang ist in Stripe zu prüfen:
Application Fees können asynchron entstehen und später erstattet werden.

Nur signierte Stripe-Connect-Webhooks bestätigen Fahrerzahlungen. Checkout-, Refund-
und Dispute-Ereignisse müssen vom Connect-Webhook kommen und werden gegen das im Tip
gespeicherte Stripe-Konto geprüft. Kartenkäufe sind separate Plattformzahlungen und
kommen nur vom Plattform-Webhook. `provider_payment_id`, `provider_intent_id` und
`tips.payment_id` sind eindeutig. Replay und verspätete Ereignisse dürfen weder ein
zweites Danke noch eine zweite Gutschrift erzeugen. Erstattungen und Disputes werden
mit kumulativem `refunded_amount_cents` in `review_required` aus den positiven
Statistiken herausgenommen, bis der Stripe-Fee-/Refund-Status geklärt ist.

### Karten

| Tabelle        | Zweck                                                                           |
| -------------- | ------------------------------------------------------------------------------- |
| `card_designs` | Aktuelles Kartendesign je Lieferant (Layout, Text, Foto ja/nein, Lieferdienst ja/nein) |
| `card_orders`  | Bestellungen physischer Karten. `design` (jsonb) friert den Stand beim Bestellen ein, damit spätere Änderungen die Produktion nicht verfälschen |

Status: `requested → confirmed → in_production → shipped → delivered` (oder `cancelled`).
Preise: `src/lib/pricing.ts`; bezahlt wird über denselben Payment-Layer wie Trinkgelder.

### Kunden

| Tabelle            | Zweck                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| `driver_favorites` | „Meine Lieferanten“ eines Kunden. Eindeutig pro Kunde und Lieferant      |

`tips.customer_id` und `thank_yous.customer_id` sind nur gesetzt, wenn ein angemeldeter Kunde
gibt – für seinen Verlauf. Die API entfernt diesen Bezug in allem, was Lieferanten sehen.

### Auswertung und Betrieb

| Tabelle         | Zweck                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| `milestones`    | Erreichte Meilensteine (eindeutig pro Typ und Wert)                   |
| `scans`         | Aufrufe der Kundenseite – Basis der Scan-to-Payment-Conversion         |
| `admin_actions` | Protokoll jeder Adminaktion                                            |
| `system_events` | Technische Fehler: Zahlung, Webhook, Mail, Connect                  |

---

## Sicherheit

- **Row Level Security** ist auf allen 16 Tabellen aktiv, **ohne Policies** – anonyme und
  angemeldete Supabase-Clients dürfen nichts. Der Server nutzt den Service-Role-Key.
- **Kein Supabase-Client im Browser.** Jeder Zugriff läuft über Server Actions oder `/api/v1`,
  wo Rolle und Besitz geprüft werden.
- **Fotos** liegen im privaten Bucket `media` unter zufälligen Schlüsseln. Ausgeliefert nur
  über `/api/media/avatar/[code]`, das „öffentlich / nur Dashboard“ prüft. Max. 2 MB,
  nur JPEG/PNG/WebP (geprüft anhand der Dateisignatur).
- **Kontodeaktivierung und Datenminimierung**: Profilinhalte werden entfernt;
  Zahlungsdatensätze und Stripe-Konto-ID bleiben für Erstattungen, Streitfälle und
  Aufbewahrungspflichten zuordenbar. Ob der Löschprozess alle rechtlichen
  Anforderungen erfüllt, muss vor Go-live fachlich geprüft werden. Export: `/api/datenexport`.

---

## Änderungen am Schema

1. Feld in `src/lib/db/types.ts` ergänzen.
2. Spalte in `supabase/schema.sql` ergänzen **und** eine Migration für bestehende Daten
   schreiben, z. B.:
   ```sql
   alter table public.driver_profiles add column if not exists pronoun text;
   ```
3. Seed (`scripts/seed.mjs`) und die Schlüsselliste in `tests/schema.test.ts` anpassen.
4. `npm test`.

Für das bestehende Produktionsprojekt zuerst
[`supabase/preflight_20260928.sql`](supabase/preflight_20260928.sql) read-only ausführen.
Konflikte anhand von Stripe und Datenbestand klären; keine Zeilen automatisch löschen.
Danach `20260927_payout_lock.sql` (historische Sicherheit und privater Bucket) und
`20260928_payment_reconciliation.sql` (Direct-Charge-Constraint und Refund-Spalte) in
dieser Reihenfolge ausführen. Beide laufen in einer Transaktion; ein Constraint-Konflikt
rollt die jeweilige Migration zurück. Den aktuellen Live-Schemastand konnten lokale
Tests nicht verifizieren.

---

## Skalierung

Auswertungen (Dashboard, Admin-KPIs) rechnen aktuell im Server über geladene Zeilen. Das ist
für Tausende Transaktionen unkritisch. Ab etwa 100 000 Trinkgeldern gehören die Summen in
SQL-Views bzw. materialisierte Views – die Indizes dafür sind bereits angelegt.
