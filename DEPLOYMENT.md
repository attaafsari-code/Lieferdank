# Deployment

Ziel: **https://lieferdank.de** – echte Datenbank, echte Zahlungen, funktionierende QR-Codes.

Reihenfolge ist wichtig: Die QR-Codes enthalten die Domain. Erst wenn die Domain läuft,
Karten drucken bzw. bestellen.

| Schritt | Dienst                  | Dauer   |
| ------- | ----------------------- | ------- |
| 1       | GitHub                  | 2 min   |
| 2       | Supabase                | 10 min  |
| 3       | Vercel                  | 10 min  |
| 4       | Domain lieferdank.de    | 10 min + DNS-Wartezeit |
| 5       | Stripe                  | 30 min + Stripe-Prüfung |
| 6       | Resend (E-Mail)         | 10 min + DNS-Wartezeit |
| 7       | Adminkonto              | 2 min   |
| 8       | Abnahme                 | 30 min  |

---

## 1. GitHub

Das Repository ist `github.com/attaafsari-code/Lieferdank`, Branch `main`.

```bash
git push origin main
```

Keine Secrets im Repo: `.env*` (außer `.env.example`), `data/`, `.claude/` und alle
`*.nosync`-Ordner sind in `.gitignore`.

---

## 2. Supabase (Datenbank + Fotos)

1. Projekt anlegen auf [supabase.com](https://supabase.com), Region **Frankfurt (eu-central-1)**.
2. **SQL Editor** → Inhalt von [`supabase/schema.sql`](supabase/schema.sql) ausführen.
   Legt 16 Tabellen, Indizes, Row Level Security und den privaten Storage-Bucket `media` an.
   Bei einem bereits bestehenden Projekt zuerst das schreibgeschützte
   [`supabase/preflight_20260928.sql`](supabase/preflight_20260928.sql) ausführen,
   Konflikte mit Stripe abgleichen und dann nacheinander
   [`supabase/migrations/20260927_payout_lock.sql`](supabase/migrations/20260927_payout_lock.sql)
   und [`supabase/migrations/20260928_payment_reconciliation.sql`](supabase/migrations/20260928_payment_reconciliation.sql)
   im SQL Editor ausführen. Beide Migrationen sind transaktional. Vorhandene
   `pending`-Auszahlungen vor dem Release mit Stripe manuell abgleichen; die App
   startet keine eigenen Transfers mehr.
   Vor dem Deployment der Version mit versioniertem Stripe-Abgleich zusätzlich
   [`supabase/migrations/20261002_payout_sync_version.sql`](supabase/migrations/20261002_payout_sync_version.sql)
   ausführen (rein additiv, mit der bisherigen Version verträglich). Ohne die Spalte
   schlagen Registrierung und Kontoabgleich der neuen Version fehl; `/api/health`
   meldet dann `"database":"migration_required"` (HTTP 503).
   Vor dem Deployment der Version mit Erstattungen ebenso
   [`supabase/migrations/20261002_tip_refunds.sql`](supabase/migrations/20261002_tip_refunds.sql)
   ausführen (rein additiv). Ohne die beiden Spalten kann die neue Version keine Trinkgelder
   anlegen; auch das meldet `/api/health` als `migration_required`.
   Vor dem Deployment der Version mit E-Mail-Bestätigung zusätzlich
   [`supabase/migrations/20261003_email_verification.sql`](supabase/migrations/20261003_email_verification.sql)
   ausführen (rein additiv). Bestehende Konten gelten danach als unbestätigt und bestätigen
   über den Hinweis im Dashboard; ohne Bestätigung startet kein Stripe-Onboarding.
3. **Project Settings → API** notieren:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` Secret → `SUPABASE_SERVICE_ROLE_KEY`

> Der Service-Role-Key umgeht RLS und darf **nur** serverseitig liegen – nie in einer
> `NEXT_PUBLIC_*`-Variable. Der `anon`-Key wird nicht gebraucht.

Details zu Tabellen und Sicherheit: [DATABASE.md](DATABASE.md).

---

## 3. Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → GitHub-Repo `Lieferdank` importieren.
2. Framework wird automatisch erkannt. `vercel.json` legt die Region auf **Frankfurt (fra1)**
   – nah an der Supabase-Datenbank.
3. Umgebungsvariablen setzen (Schritt 3a), dann **Deploy**.
   Der Produktionsbuild nutzt den von Next.js 16 unterstützten Webpack-Modus
   (`npm run build`).

### 3a. Umgebungsvariablen (Scope: Production)

| Variable                        | Wert                                   | Pflicht |
| ------------------------------- | -------------------------------------- | ------- |
| `NEXT_PUBLIC_BASE_URL`          | `https://lieferdank.de`                | ja      |
| `NEXT_PUBLIC_SITE_URL`          | `https://lieferdank.de`                | ja      |
| `AUTH_SECRET`                   | `openssl rand -base64 48`              | ja      |
| `LIEFERDANK_DB`                 | `supabase`                             | ja      |
| `SUPABASE_URL`                  | aus Schritt 2                          | ja      |
| `SUPABASE_SERVICE_ROLE_KEY`     | aus Schritt 2                          | ja      |
| `PAYMENT_PROVIDER`              | `stripe`                               | ja      |
| `STRIPE_SECRET_KEY`             | aus Schritt 5                          | ja      |
| `STRIPE_WEBHOOK_SECRET`         | aus Schritt 5 (Plattform-Webhook)      | ja      |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | aus Schritt 5 (Connect-Webhook)        | ja      |
| `RESEND_API_KEY`                | aus Schritt 6                          | ja      |
| `MAIL_FROM`                     | `Lieferdank <noreply@lieferdank.de>`   | ja      |
| `MAIL_REPLY_TO`                 | z. B. `hallo@lieferdank.de`            | nein    |
| `CARD_ORDERS_PAID`              | `true`, sobald Karten Geld kosten      | nein    |
| `ALLOW_PREVIEW_SUPABASE_TEST_PROJECT` | `true` nur für getrenntes Preview-Testprojekt | Preview |

Nach jeder Änderung an `NEXT_PUBLIC_*` **neu deployen** – diese Werte werden beim Build
eingebacken.

**Sicherheitsnetze, falls etwas fehlt:**
- Ohne `AUTH_SECRET` schlagen Anmeldungen fehl und der Health-Check ist nicht bereit.
- Eine falsche `NEXT_PUBLIC_BASE_URL` (localhost, http, private IP) wird in Produktion
  ignoriert – QR-Codes zeigen dann trotzdem auf `https://lieferdank.de`.
- Ohne `LIEFERDANK_DB=supabase` wird im Production-Scope keine flüchtige
  Testdatenbank verwendet. Der Health-Check liefert `503`.
- Ohne `PAYMENT_PROVIDER=stripe` sind echte Trinkgelder im Production-Scope
  gesperrt; kostenloses Danke bleibt verfügbar. Der Health-Check liefert `503`.
- Ein Stripe-Testschlüssel meldet im Production-Scope ebenfalls `503` im
  Health-Check, auch wenn Sandbox-Zahlungen technisch möglich sind.
- Ohne `RESEND_API_KEY` ist das Zurücksetzen von Passwörtern in Produktion
  nicht verfügbar. Reset-Links landen nie im Serverlog.

Preview-Deployments dürfen nicht auf das Production-Supabase-Projekt zugreifen.
Die App blockiert Supabase im Preview-Scope ohne `ALLOW_PREVIEW_SUPABASE_TEST_PROJECT=true`
und blockiert Stripe-Live-Schlüssel dort immer. QR-Codes im Preview verwenden
die jeweilige Preview-Domain, auch wenn eine Production-Base-URL geerbt wurde.
Erst ein separates Testprojekt und
Stripe-Testschlüssel eintragen, dann den Preview-Opt-in setzen. Demo + Supabase
benötigt zusätzlich `ALLOW_DEMO_SUPABASE_TEST_PROJECT=true` in einer isolierten
Testumgebung; niemals in Production setzen.

---

## 4. Domain lieferdank.de

Vercel → Project → **Settings → Domains**:

1. `lieferdank.de` hinzufügen → **Primary**
2. `www.lieferdank.de` hinzufügen → „Redirect to lieferdank.de“ wählen

Beim Domain-Anbieter:

| Typ   | Name  | Wert                    |
| ----- | ----- | ----------------------- |
| A     | `@`   | `76.76.21.21`           |
| CNAME | `www` | `cname.vercel-dns.com.` |

Die exakten Werte zeigt Vercel im Dialog – im Zweifel die von dort nehmen.

- **HTTPS**: Vercel stellt das Zertifikat automatisch aus, sobald DNS zeigt.
- **www → lieferdank.de**: zusätzlich in `next.config.ts` per 308 abgesichert.
- **Canonical**: alle Seiten verweisen auf `https://lieferdank.de`.
- **HSTS**: zwei Jahre, inkl. Subdomains.

---

## 5. Stripe (Zahlungen)

### Konto, Gebühren und Connect

1. Stripe Connect für Deutschland aktivieren und das Plattformprofil abschließen.
2. Neue Fahrer werden als **Standard Connected Accounts** mit Stripe Hosted Onboarding
   angelegt. Vor jedem Checkout liest die App den Account frisch bei Stripe und verlangt:
   `country=DE`, `charges_enabled=true`, `payouts_enabled=true`,
   `card_payments=active`, `transfers=active`, `details_submitted=true`,
   `controller.fees.payer=account` und `controller.losses.payments=stripe`.
   Alte Express-Konten erfüllen diese Bedingungen nicht und nehmen kein Trinkgeld an.
   Sie dürfen nicht still umgedeutet werden; betroffene Fahrer müssen nach Prüfung
   ein geeignetes neues Konto verbinden.
3. Stripe zieht seine Processing-Kosten vom Connected Account ab und übernimmt bei
   dieser Konfiguration dessen Negativsaldo-Risiko. Refunds und Disputes belasten
   zunächst das Connected Account; Dispute-Gebühren ebenfalls. Lieferdank bleibt
   für sein eigenes Plattformkonto und eigene optionale Stripe-Produkte verantwortlich.
4. Anwendungseigene Gebühren: 2 € → 0,50 €, 3 € → 0,60 €, 5 € → 1,00 €.
   Der Kunde zahlt exakt den gewählten Betrag. Fahreranteile **vor** Stripe-Kosten:
   1,50 €, 2,40 €, 4,00 €. Andere Kartenarten, Währungen und Zusatzdienste können
   andere Gebühren auslösen und dürfen nicht ungeprüft Lieferdank belasten.
5. Normale Auszahlungen richtet der Fahrer in Stripe ein. Keine Instant Payouts,
   keine Lieferdank-Transfer-/Wallet-Funktion. Einen monatlichen Rhythmus erst nach
   Prüfung der Account-Berechtigung und konkreten Stripe-Kosten konfigurieren.

### Zahlarten

Checkout fordert `card` an; geeignete Geräte können Apple Pay/Google Pay anzeigen.
PayPal ist absichtlich nicht eingerichtet. Die tatsächliche Wallet-Anzeige hängt von
Gerät, Browser, Stripe-Account und Dashboard-Einstellungen ab.

### Webhooks

**Stripe Dashboard → Developers → Webhooks**: zwei Ziele unter
`https://lieferdank.de/api/webhooks/stripe` mit **unterschiedlichen Secrets**.

- **Your account / Plattform**: bestehende neun Checkout-, Refund- und Dispute-Ereignisse
  für Lieferdanks eigene Kartenkäufe. Secret: `STRIPE_WEBHOOK_SECRET`.
- **Connected accounts / Connect**: `account.updated`,
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`,
  `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`,
  `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`.
  Secret: `STRIPE_CONNECT_WEBHOOK_SECRET`. **Das Connect-Ziel mit nur
  `account.updated` ist für Direct Charges unvollständig und muss vor Go-live
  erweitert werden.**

Signatur, Webhook-Quelle, Connect-Konto, Checkout-ID, Betrag, Währung,
PaymentIntent, Application Fee und Server-Metadaten werden geprüft.
Der signierte Webhook – niemals die Browser-Rückkehr –
bucht eine Zahlung. Trinkgeld-Erstattungen aus dem Admin setzen
`refund_application_fee=true`; bei Teilrefund erstattet Stripe die Fee proportional.
Für jedes `charge.refunded` liest die App den Stand bei Stripe und gibt einen noch
fehlenden Anteil der Lieferdank-Gebühr selbst zurück – auch nach Erstattungen im
Stripe-Dashboard des Lieferanten. Rückbuchungen (Disputes) und Vorgänge in
`review_required` bewegen nie automatisch Geld und werden von Hand abgeglichen.
Doppelte oder verspätete Webhooks senken gebuchte Beträge nie.
Die Admin-KPIs zeigen vorgesehene Application Fees aus bestätigten Zahlungen;
Stripe kann die tatsächlichen Fee-Objekte asynchron erzeugen. Für Buchhaltung und
Refund-Abgleich sind die Stripe-Berichte maßgeblich.

Ein eingeschränkter `rk_live_…`-Schlüssel benötigt die Rechte für Checkout Sessions,
Accounts/Account Links, PaymentIntents/Charges auf Connected Accounts, Refunds und
Application Fees. Transfer-Schreibrechte sind für den neuen Fahrerfluss nicht nötig.
Keine Live-Schlüssel in Preview verwenden.

## 6. Resend (E-Mail)

1. [resend.com](https://resend.com) → **Domains** → `lieferdank.de` hinzufügen.
2. Die angezeigten DNS-Einträge (SPF, DKIM, optional DMARC) beim Domain-Anbieter setzen.
3. **API Keys** → Key mit „Sending access“ → `RESEND_API_KEY`.

Versendet werden: Willkommen mit Bestätigungslink (Lieferant und Kunde), E-Mail bestätigen
(erneut senden), Passwort vergessen, Trinkgeld erhalten (abschaltbar), Kartenbestellung
eingegangen, Karte versendet. Jede Mail verlinkt Impressum, Datenschutz und AGB. Ohne Key wird
nichts verschickt – Fehlversuche stehen im Admin unter **System**.

---

## 7. Adminkonto

Admins können sich nicht selbst registrieren.

1. Auf `https://lieferdank.de/register` normal registrieren.
2. In Supabase → SQL Editor:
   ```sql
   update public.users set role = 'admin', email_verified_at = coalesce(email_verified_at, now())
     where email = 'deine@adresse.de';
   delete from public.driver_profiles where user_id = (select id from public.users where email = 'deine@adresse.de');
   ```
3. Neu anmelden → `/admin`.

---

## 8. Abnahme

- [ ] `https://lieferdank.de` lädt, `https://www.lieferdank.de` leitet weiter
- [ ] `https://lieferdank.de/api/health` liefert HTTP 200 und zeigt `"database":"supabase","payments":"stripe","mail":"resend"`
- [ ] Registrierung → sofort ein Danke-Code, Willkommensmail mit Bestätigungslink kommt an
- [ ] Ohne bestätigte E-Mail: Hinweis im Dashboard, „Auszahlungskonto einrichten“ wird abgelehnt
- [ ] Bestätigungslink öffnen → erst der Klick auf „E-Mail-Adresse bestätigen“ bestätigt
- [ ] `/dashboard/karte` zeigt **keinen** Hinweis auf eine lokale Adresse, Link beginnt mit `https://lieferdank.de/danke/`
- [ ] QR-Code mit **iPhone** und **Android** scannen (von Bildschirm und Ausdruck)
- [ ] Kostenlos Danke → erscheint im Dashboard
- [ ] 2 €, 3 €, 5 € in Stripe-Testumgebung testen → 0,50 / 0,60 / 1,00 € Application Fee; 1,50 / 2,40 / 4,00 € vor Stripe-Kosten beim Connected Account
- [ ] Apple Pay (Safari/iPhone) und Google Pay (Chrome/Android) erscheinen im Checkout
- [ ] Zahlung abbrechen → zurück auf der Danke-Seite, nichts gebucht
- [ ] Auszahlungskonto einrichten → Status „bereit“
- [ ] Admin: Direct Charge und Application Fee sichtbar; keine Lieferdank-Auszahlungsaktion
- [ ] Profilfoto „nur im Dashboard“ → auf der Kundenseite nicht sichtbar
- [ ] Passwort vergessen → Mail kommt an, Link funktioniert einmal
- [ ] Nur mit `CARD_ORDERS_PAID=true`: Kartenbestellung → Admin setzt „Versendet“ → Versandmail kommt an.
      Ohne die Variable bewirbt keine Seite Plastikkarten und die Bestellung ist gesperrt
- [ ] Auf dem Handy „Zum Home-Bildschirm“ → startet als App
- [ ] Rechtstexte durch Rechtsberatung geprüft, Platzhalter ersetzt

---

## Betrieb

- **Logs**: Vercel → Project → Logs. Fachliche Fehler (Zahlung, Mail, Webhook) zusätzlich im
  Admin unter **System**.
- **Uptime**: `/api/health` in einen Monitoring-Dienst eintragen.
- **Backups**: Supabase erstellt tägliche Backups (Pro-Plan: Point-in-Time-Recovery).
- **Rollback**: Vercel → Deployments → letztes funktionierendes → **Promote to Production**.
  Achtung: vor einem Rollback Datenbankschema- und Webhook-Kompatibilität prüfen.
- **Rate Limiting** läuft im Arbeitsspeicher pro Instanz (Anmeldung pro IP und pro Konto,
  Registrierung, Passwort-Reset pro IP und pro Adresse, Danke, Trinkgeld, Nachrichten,
  Scans, Stripe-Onboarding). Auf Vercel ist das nur ein Grundschutz, weil parallele
  Instanzen getrennt zählen. Für echten Schutz eine Vercel-Firewall-Regel (Rate Limiting)
  oder Upstash Redis ergänzen (siehe DECISIONS.md).
- **CI**: `.github/workflows/ci.yml` prüft Typecheck, Lint, Tests und Build bei jedem Pull
  Request und Push auf `main`. Dieselben Prüfungen laufen zusätzlich im Vercel-Build
  (`buildCommand` in `vercel.json`): Schlägt eine fehl, scheitert das Deployment und
  Production bleibt auf dem letzten grünen Stand. Die Tests laufen dort mit leerer Umgebung
  (`env -i`), damit sie nie Production-Schlüssel sehen.
