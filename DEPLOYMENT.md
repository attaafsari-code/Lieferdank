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
   Bei einem bereits bestehenden Projekt zusätzlich
   [`supabase/migrations/20260927_payout_lock.sql`](supabase/migrations/20260927_payout_lock.sql)
   im SQL Editor ausführen. Vorher vorhandene `pending`-Auszahlungen mit Stripe
   abgleichen; der Index verhindert parallele Doppelüberweisungen. Die Migration
   sperrt außerdem den Foto-Bucket und ergänzt den Status für erstattete Karten.
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
| `PAYMENT_FEE_PERCENT` usw.      | nur, wenn die Stripe-Sätze abweichen   | nein    |

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

Preview-Deployments (jeder Branch) nutzen automatisch ihre eigene Vercel-Adresse für
QR-Codes. Für Previews am besten ein separates Supabase-Projekt und Stripe-Testschlüssel.

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

### Konto und Connect

1. Stripe-Konto anlegen (Land: Deutschland), Unternehmensdaten vervollständigen.
2. **Connect** aktivieren → Kontotyp **Express**. Stripe fragt nach dem Plattformprofil
   (Marktplatz / Trinkgeld an Dienstleister).
3. Zuerst komplett mit **Testschlüsseln** (`sk_test_…`) arbeiten.

### Zahlarten

Checkout zeigt automatisch alle Zahlarten, die unter **Settings → Payment methods**
aktiviert sind:

- **Karte** – immer aktiv
- **Apple Pay / Google Pay** – aktivieren; bei Stripe Checkout ist keine eigene
  Domain-Verifizierung nötig
- **PayPal** – später; für diesen Release weder aktivieren noch voraussetzen.
- **Link** – optional, beschleunigt wiederkehrende Kunden

### Webhooks

**Developers → Webhooks**, zwei Endpunkte auf dieselbe URL
`https://lieferdank.de/api/webhooks/stripe`:

| Endpunkt       | „Listen to“             | Ereignisse                                                                                                                    | Secret → Variable               |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Plattform      | Your account            | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded` | `STRIPE_WEBHOOK_SECRET`         |
| Connect        | Connected accounts      | `account.updated`                                                                                                             | `STRIPE_CONNECT_WEBHOOK_SECRET` |

Lokal testen:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Wichtig:** Eine Zahlung gilt ausschließlich dann als bezahlt, wenn der signierte Webhook
sie meldet. Die Rückkehr-URL des Kunden ändert nichts. Doppelte Zustellungen werden
erkannt und nur einmal gebucht.

### Live gehen

Testflow komplett durchspielen (Schritt 8), dann Live-Schlüssel (auch ein
eingeschränkter `rk_live_…`-Schlüssel mit den benötigten Berechtigungen) und die
Live-Webhook-Secrets in Vercel eintragen, neu deployen. Der Admin zeigt oben „Live“ statt
„Sandbox“.

Der eingeschränkte Schlüssel muss Checkout-Sessions, PaymentIntents, Express-Accounts,
Account-Links und Transfers erstellen bzw. lesen können. Refunds benötigen eigene
Berechtigung; eine Teil-Erstattung wird im aktuellen MVP konservativ als vollständig
erstattet verbucht und muss im Admin/Stripe manuell abgestimmt werden. Erstattungen
nach einem bereits ausgeführten Transfer ebenfalls manuell mit dem Stripe-Konto
abgleichen. Keine Teil-Erstattungen ohne diesen Abgleich auslösen.

---

## 6. Resend (E-Mail)

1. [resend.com](https://resend.com) → **Domains** → `lieferdank.de` hinzufügen.
2. Die angezeigten DNS-Einträge (SPF, DKIM, optional DMARC) beim Domain-Anbieter setzen.
3. **API Keys** → Key mit „Sending access“ → `RESEND_API_KEY`.

Versendet werden: Willkommen (Lieferant und Kunde), Passwort vergessen, Trinkgeld erhalten
(abschaltbar), Auszahlung, Kartenbestellung eingegangen, Karte versendet. Ohne Key wird
nichts verschickt – Fehlversuche stehen im Admin unter **System**.

---

## 7. Adminkonto

Admins können sich nicht selbst registrieren.

1. Auf `https://lieferdank.de/register` normal registrieren.
2. In Supabase → SQL Editor:
   ```sql
   update public.users set role = 'admin' where email = 'deine@adresse.de';
   delete from public.driver_profiles where user_id = (select id from public.users where email = 'deine@adresse.de');
   ```
3. Neu anmelden → `/admin`.

---

## 8. Abnahme

- [ ] `https://lieferdank.de` lädt, `https://www.lieferdank.de` leitet weiter
- [ ] `https://lieferdank.de/api/health` liefert HTTP 200 und zeigt `"database":"supabase","payments":"stripe","mail":"resend"`
- [ ] Registrierung → sofort ein Danke-Code, Willkommensmail kommt an
- [ ] `/dashboard/karte` zeigt **keinen** Hinweis auf eine lokale Adresse, Link beginnt mit `https://lieferdank.de/danke/`
- [ ] QR-Code mit **iPhone** und **Android** scannen (von Bildschirm und Ausdruck)
- [ ] Kostenlos Danke → erscheint im Dashboard
- [ ] 2 €, 3 €, 5 € mit Testkarte `4242 4242 4242 4242` → 1,50 / 2,50 / 4,50 € im Guthaben
- [ ] Apple Pay (Safari/iPhone) und Google Pay (Chrome/Android) erscheinen im Checkout
- [ ] Zahlung abbrechen → zurück auf der Danke-Seite, nichts gebucht
- [ ] Auszahlungskonto einrichten → Status „bereit“
- [ ] Admin: Transaktion mit Nettomarge sichtbar, Auszahlung auslösen
- [ ] Profilfoto „nur im Dashboard“ → auf der Kundenseite nicht sichtbar
- [ ] Passwort vergessen → Mail kommt an, Link funktioniert einmal
- [ ] Kartenbestellung → Admin setzt „Versendet“ → Versandmail kommt an
- [ ] Auf dem Handy „Zum Home-Bildschirm“ → startet als App
- [ ] Rechtstexte durch Rechtsberatung geprüft, Platzhalter ersetzt

---

## Betrieb

- **Logs**: Vercel → Project → Logs. Fachliche Fehler (Zahlung, Mail, Webhook) zusätzlich im
  Admin unter **System**.
- **Uptime**: `/api/health` in einen Monitoring-Dienst eintragen.
- **Backups**: Supabase erstellt tägliche Backups (Pro-Plan: Point-in-Time-Recovery).
- **Rollback**: Vercel → Deployments → letztes funktionierendes → **Promote to Production**.
  Die Datenbank bleibt davon unberührt.
- **Rate Limiting** läuft im Arbeitsspeicher pro Instanz. Bei viel Verkehr auf Upstash
  Redis umstellen (siehe DECISIONS.md).
