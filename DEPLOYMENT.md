# Deployment

Ziel: **https://lieferdank.de** – produktiv, mit echter Datenbank, echten Zahlungen
und funktionierenden QR-Codes.

---

## 0. Reihenfolge

Die Reihenfolge ist wichtig, weil die QR-Codes die Basis-URL enthalten. Erst wenn
`NEXT_PUBLIC_BASE_URL` steht, dürfen Karten gedruckt werden.

1. Supabase-Projekt anlegen und Schema ausrollen
2. Auf Vercel deployen
3. Domain verbinden
4. Umgebungsvariablen setzen (inkl. Basis-URL)
5. Stripe Connect verbinden und Webhook einrichten
6. Adminkonto anlegen
7. End-to-End testen

---

## 1. Datenbank (Supabase)

1. Auf [supabase.com](https://supabase.com) ein Projekt in der Region **Frankfurt (eu-central-1)**
   anlegen – deutsche Nutzerdaten bleiben so in der EU.
2. Im SQL-Editor den Inhalt von [`supabase/schema.sql`](supabase/schema.sql) ausführen.
3. Unter *Project Settings → API* notieren:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` Key → `SUPABASE_SERVICE_ROLE_KEY`

> Der `service_role`-Key darf **nur** serverseitig verwendet werden. Er steht in keiner
> `NEXT_PUBLIC_*`-Variable und taucht nirgends im Frontend auf. RLS ist auf allen
> Tabellen aktiv und verweigert per Default alles.

---

## 2. Deployment (Vercel)

Das Projekt ist ein Standard-Next.js-Projekt (App Router, Node-Runtime). Vercel erkennt
alles automatisch, es braucht keine `vercel.json`.

```bash
npm i -g vercel
vercel link          # Projekt anlegen oder verbinden
vercel --prod        # erstes Produktionsdeployment
```

Alternativ: Repository auf GitHub pushen und in Vercel importieren.

**Netlify** funktioniert grundsätzlich auch, braucht aber das offizielle
`@netlify/plugin-nextjs` für Server Actions und Route Handler. Getestet ist Vercel.

---

## 3. Domain verbinden

In Vercel unter *Project → Settings → Domains*:

1. `lieferdank.de` hinzufügen → als **Primary Domain** setzen
2. `www.lieferdank.de` hinzufügen → Vercel bietet automatisch eine Weiterleitung an;
   zusätzlich leitet [`next.config.ts`](next.config.ts) `www` per 308 auf die Hauptdomain
   um, falls das Projekt später woanders läuft.

Beim DNS-Anbieter der Domain eintragen:

| Typ   | Name  | Wert                    |
| ----- | ----- | ----------------------- |
| A     | `@`   | `76.76.21.21`           |
| CNAME | `www` | `cname.vercel-dns.com.` |

Die exakten Werte zeigt Vercel im Domain-Dialog an – nimm im Zweifel die von dort.

**HTTPS** stellt Vercel automatisch über Let's Encrypt aus, sobald das DNS zeigt.
Zusätzlich sendet die App `Strict-Transport-Security` mit zwei Jahren Gültigkeit.

---

## 4. Umgebungsvariablen (Production)

In Vercel unter *Settings → Environment Variables*, Scope **Production**:

| Variable                    | Wert                                |
| --------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_BASE_URL`      | `https://lieferdank.de`             |
| `NEXT_PUBLIC_SITE_URL`      | `https://lieferdank.de`             |
| `AUTH_SECRET`               | `openssl rand -base64 48`           |
| `LIEFERDANK_DB`             | `supabase`                          |
| `SUPABASE_URL`              | aus Schritt 1                       |
| `SUPABASE_SERVICE_ROLE_KEY` | aus Schritt 1                       |
| `PAYMENT_PROVIDER`          | `stripe`                            |
| `STRIPE_SECRET_KEY`         | aus Schritt 5                       |
| `STRIPE_WEBHOOK_SECRET`     | aus Schritt 5                       |
| `RESEND_API_KEY`            | optional, für „Passwort vergessen“  |
| `MAIL_FROM`                 | `Lieferdank <noreply@lieferdank.de>`|

Danach **neu deployen** – `NEXT_PUBLIC_*` wird zur Buildzeit eingebacken.

> Fehlt `AUTH_SECRET` in Produktion, zeigt die App oben einen roten Warnbalken und
> Anmeldungen schlagen fehl. Das ist Absicht: still kaputt wäre schlimmer.

---

## 5. Zahlungen (Stripe Connect)

1. Stripe-Konto anlegen, unter *Connect* **Express-Accounts** aktivieren.
2. Zuerst mit **Testschlüsseln** (`sk_test_…`) deployen und den kompletten Flow testen.
3. Webhook anlegen: *Developers → Webhooks → Add endpoint*
   - URL: `https://lieferdank.de/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `checkout.session.expired`,
     `charge.refunded`, `account.updated`
   - Signing Secret → `STRIPE_WEBHOOK_SECRET`
4. Lokal testen:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

Eine Zahlung gilt **ausschließlich** dann als erfolgreich, wenn der signierte Webhook
sie bestätigt. Die Rückkehr-URL des Kunden ändert nichts – sie ist manipulierbar.

Kartendaten berührt Lieferdank nie: Der Checkout läuft vollständig bei Stripe.

---

## 6. Adminkonto anlegen

Es gibt bewusst keine Selbstregistrierung für Admins.

1. Unter `https://lieferdank.de/register` normal registrieren.
2. In Supabase im SQL-Editor:
   ```sql
   update public.users set role = 'admin' where email = 'deine@adresse.de';
   ```
3. Neu anmelden → `/admin` ist erreichbar.

---

## 7. Abnahme vor dem Feldtest

- [ ] `https://lieferdank.de` lädt, `www.lieferdank.de` leitet weiter
- [ ] Registrierung erzeugt sofort einen Danke-Code
- [ ] `/dashboard/code` zeigt **keinen** roten Hinweis auf eine lokale Adresse
- [ ] QR-Code mit einem echten iPhone **und** einem Android-Gerät scannen
- [ ] Kostenloses Danke funktioniert, erscheint im Dashboard
- [ ] 2 €, 3 € und 5 € durchbezahlt (Stripe-Testkarte `4242 4242 4242 4242`)
- [ ] Beträge stimmen: 2 € → 1,50 €, 3 € → 2,50 €, 5 € → 4,50 €
- [ ] Zahlung abbrechen führt zurück auf die Danke-Seite
- [ ] Guthaben im Dashboard stimmt
- [ ] Admin sieht Transaktion inklusive Netto-Marge
- [ ] „Passwort vergessen“ verschickt eine E-Mail
- [ ] Karte drucken: 10 Karten pro A4-Seite, QR scannt vom Papier
- [ ] Rechtstexte durch Rechtsberatung geprüft und Platzhalter ersetzt

---

## Rollback

Vercel behält jedes Deployment. Unter *Deployments* das letzte funktionierende
auswählen → *Promote to Production*. Die Datenbank bleibt davon unberührt.
