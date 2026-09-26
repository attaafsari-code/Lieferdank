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
| Lieferdank-Code     | immer großgeschrieben, z. B. `LD-84K2P`; ohne verwechselbare Zeichen      |
| Status              | Text mit `check`-Constraint statt Enum-Typ – leichter zu erweitern        |

---

## Tabellen

### Konten

| Tabelle             | Zweck                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| `users`             | Alle Konten: Lieferant, Kunde, Admin. Passwort als scrypt-Hash, `token_version` für Session-Widerruf |
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

```
payments ──1:1── tips ──1:1── thank_yous
    │              │
    │              └──n:1── payouts
    └──1:1── card_orders
```

| Tabelle    | Zweck                                                                             |
| ---------- | --------------------------------------------------------------------------------- |
| `payments` | Eine Transaktion beim Zahlungsdienstleister. Quelle der Wahrheit für „bezahlt“    |
| `tips`     | Ein Trinkgeld mit vollständiger Aufteilung                                        |
| `payouts`  | Eine Sammelauszahlung an einen Lieferanten                                        |

**Aufteilung eines Trinkgelds** (`tips`):

| Spalte                        | 3 €-Beispiel | Bedeutung                                              |
| ----------------------------- | -----------: | ------------------------------------------------------ |
| `gross_cents`                 |          300 | Was der Kunde zahlt                                    |
| `driver_cents`                |          250 | Gehört dem Lieferanten                                 |
| `platform_gross_fee_cents`    |           50 | Fester Plattformanteil                                 |
| `payment_provider_fee_cents`  |           30 | Kalkulierte Stripe-Kosten (1,5 % + 0,25 €)             |
| `payout_fee_cents`            |    0 → z. B. 1 | Anteil der Auszahlungsgebühr, gesetzt bei Auszahlung |
| `platform_net_revenue_cents`  |      20 → 19 | Brutto − Payment − Auszahlung = echte Marge            |

`check (driver_cents + platform_gross_fee_cents = gross_cents)` garantiert, dass der Kunde
nie mehr zahlt als gewählt.

**`destination_account_id`**: Ist beim Zahlen schon ein Stripe-Konto des Lieferanten
einsatzbereit, fließt sein Anteil direkt dorthin (Destination Charge). Sonst hält die
Plattform das Geld, und die Auszahlung überweist es. So wird nie doppelt gezahlt.

**Idempotenz**: `payments.provider_payment_id` und `tips.payment_id` sind eindeutig. Stripe
stellt Webhooks mehrfach zu – gebucht wird trotzdem nur einmal.

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
| `system_events` | Technische Fehler: Zahlung, Webhook, Mail, Auszahlung                  |

---

## Sicherheit

- **Row Level Security** ist auf allen 16 Tabellen aktiv, **ohne Policies** – anonyme und
  angemeldete Supabase-Clients dürfen nichts. Der Server nutzt den Service-Role-Key.
- **Kein Supabase-Client im Browser.** Jeder Zugriff läuft über Server Actions oder `/api/v1`,
  wo Rolle und Besitz geprüft werden.
- **Fotos** liegen im privaten Bucket `media` unter zufälligen Schlüsseln. Ausgeliefert nur
  über `/api/media/avatar/[driverId]`, das „öffentlich / nur Dashboard“ prüft. Max. 2 MB,
  nur JPEG/PNG/WebP (geprüft anhand der Dateisignatur).
- **Löschung (DSGVO)**: Persönliche Daten werden entfernt, Zahlungsdatensätze bleiben
  anonymisiert (Aufbewahrungspflichten). Export: `/api/datenexport`.

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

Für Produktion empfiehlt sich ab dem ersten echten Nutzer die Supabase CLI mit
versionierten Migrationen (`supabase/migrations/`).

---

## Skalierung

Auswertungen (Dashboard, Admin-KPIs) rechnen aktuell im Server über geladene Zeilen. Das ist
für Tausende Transaktionen unkritisch. Ab etwa 100 000 Trinkgeldern gehören die Summen in
SQL-Views bzw. materialisierte Views – die Indizes dafür sind bereits angelegt.
