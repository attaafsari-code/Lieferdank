# App-Roadmap: iOS und Android

Lieferdank läuft heute als Web-App und PWA. Dieses Dokument beschreibt, was für native Apps
schon vorbereitet ist und welche Schritte bis in den App Store und Play Store fehlen.

**Grundsatz:** Der Kunde braucht nie eine App. Die Kundenseite nach dem QR-Scan bleibt immer
eine Webseite. Die App ist ein Komfortangebot – für Lieferanten und für Kunden, die ihre
Lieblingslieferanten speichern wollen.

---

## Was schon vorbereitet ist

| Baustein                        | Stand                                                                     |
| ------------------------------- | ------------------------------------------------------------------------- |
| REST-API `/api/v1`              | Fertig, getestet (`tests/api.test.ts`)                                   |
| Auth für Apps                   | Bearer-Token (30 Tage), gebunden an `token_version` → sofort widerrufbar |
| Getrennte Fachlogik             | `src/lib/` ohne Server- oder DOM-Abhängigkeit – direkt in Expo nutzbar    |
| Services                        | `src/server/services/` – Web und API rufen dieselbe Logik auf             |
| PWA                             | Manifest, Icons, iOS-Splash, Service Worker, Offline-Seite, Start `/app` |
| Zwei Rollen                     | `driver` und `customer` im Datenmodell, Kundenkonto optional              |
| Favoriten                       | `driver_favorites`, API vorhanden                                        |
| Konto löschen im Produkt        | Vorhanden (Apple verlangt das für Apps mit Konto)                         |

### Wiederverwendbar ohne Änderung

```
src/lib/money.ts            Beträge, Aufteilung, Gebühren
src/lib/names.ts            Anzeigename, Dativ („Herrn Müller“), Initialen
src/lib/card/svg.ts         Kartenrenderer (in React Native via react-native-svg)
src/lib/card/design.ts      Layouts, Textvorlagen
src/lib/milestone-rules.ts  Meilensteine
src/lib/messages.ts         Nachrichtenvorlagen
src/lib/providers.ts        Liefer- und Zustelldienste
src/lib/format.ts           Euro- und Datumsformate
src/lib/db/types.ts         Alle Datentypen
```

Empfehlung: Beim Start der App diese Dateien in ein Paket `packages/core` verschieben
(npm Workspaces), damit Web und App dieselbe Quelle nutzen.

---

## API v1

Basis: `https://lieferdank.de/api/v1`. Antworten sind JSON. Fehler kommen immer als
`{ "error": { "code", "message", "field?" } }` mit passendem HTTP-Status.

**Auth:** `Authorization: Bearer <token>`. Cookies werden von der API bewusst ignoriert
(Schutz vor CSRF). Token im sicheren Gerätespeicher ablegen (iOS Keychain, Android
Keystore – z. B. `expo-secure-store`).

### Öffentlich

| Methode | Pfad                              | Zweck                                          |
| ------- | --------------------------------- | ---------------------------------------------- |
| GET     | `/drivers/{code}`                 | Öffentliches Profil + Trinkgeldstufen. `?scan=0` zählt nicht als Scan |
| POST    | `/drivers/{code}/thanks`          | Kostenlos Danke sagen → `{ thankYouId, messageToken }` |
| POST    | `/drivers/{code}/tips`            | `{ amountCents }` → `{ checkoutUrl, paymentId }` |
| POST    | `/thanks/{id}/message`            | `{ messageToken, presetId?, message? }` – nur mit dem Token des Absenders, einmalig |
| POST    | `/auth/login`                     | `{ email, password }` → `{ token, user }`      |
| POST    | `/auth/register`                  | `{ role, firstName, lastName?, email, password, acceptedTerms: true }` |

Ist bei Danke/Trinkgeld ein Kunden-Token dabei, landet der Vorgang im Verlauf des Kunden.

### Lieferant (Token mit Rolle `driver`)

| Methode | Pfad          | Zweck                                                     |
| ------- | ------------- | --------------------------------------------------------- |
| GET     | `/me`         | Konto und öffentliches Profil                             |
| GET     | `/me/stats`   | Heute / Woche / Monat, Guthaben, Nachrichten, Meilensteine |
| GET     | `/me/code`    | Code, Ziel-URL, QR-Code als SVG                           |

### Kunde (Token mit Rolle `customer`)

| Methode | Pfad                    | Zweck                         |
| ------- | ----------------------- | ----------------------------- |
| GET     | `/me/favorites`         | Meine Lieferanten             |
| POST    | `/me/favorites`         | `{ code }` speichern          |
| PATCH   | `/me/favorites/{id}`    | `{ nickname }`                |
| DELETE  | `/me/favorites/{id}`    | entfernen                     |

### Noch zu ergänzen, wenn die App gebaut wird

- `PATCH /me/profile`, `POST /me/photo`, `PUT /me/card` (Services existieren, nur Routen fehlen)
- `GET /me/history` für Kunden (Service `customerHistory` existiert)
- `POST /me/devices` für Push-Tokens
- Passwort-Reset und Konto löschen per API

---

## Technik für die Apps

**Empfehlung: Expo (React Native) mit Expo Router.** Ein Codebestand für iOS und Android,
TypeScript wie die Web-App, die Fachlogik aus `src/lib` läuft unverändert.

| Funktion                 | Paket                                  |
| ------------------------ | -------------------------------------- |
| QR-Scanner (Kunde)       | `expo-camera`                          |
| Karte anzeigen/teilen    | `react-native-svg` + `src/lib/card/svg.ts` |
| Bezahlen                 | `checkoutUrl` in `expo-web-browser` öffnen (Stripe Checkout mit Apple Pay/Google Pay) |
| Token speichern          | `expo-secure-store`                    |
| Push                     | `expo-notifications` (APNs / FCM)      |
| Wallet-Pass (später)     | Apple Wallet / Google Wallet mit dem QR-Code |

### Zwei Modi in einer App

Nach der Anmeldung entscheidet die Rolle:

- **Lieferant:** Dashboard · Karte & QR · Einnahmen · Profil · Auszahlung
- **Kunde:** QR scannen · Meine Lieferanten · Danke / Trinkgeld · Verlauf

Ohne Anmeldung: nur QR-Scanner – er öffnet dieselbe Danke-Seite wie im Browser.

---

## Schritte für App Store und Play Store

### Einmalig

1. **Apple Developer Program** – 99 $/Jahr. Für ein Firmenkonto wird eine D-U-N-S-Nummer
   gebraucht (kostenlos, einige Tage Bearbeitung).
2. **Google Play Console** – 25 $ einmalig. Neue private Konten müssen vor der
   Veröffentlichung einen geschlossenen Test mit mehreren Testern durchlaufen – Zeit einplanen.
3. **Bundle-ID / Package-Name** festlegen, z. B. `de.lieferdank.app`.
4. **Expo EAS** einrichten (`eas build`, `eas submit`) – baut und reicht ein, ohne eigenen Mac-Build-Server.

### Vor der ersten Einreichung

- **Universal Links (iOS) / App Links (Android)** für `https://lieferdank.de/danke/*`:
  `/.well-known/apple-app-site-association` und `/.well-known/assetlinks.json` ausliefern
  (Team-ID und Signatur-Fingerprint stehen erst mit den Entwicklerkonten fest). Dann öffnet
  ein Scan die App, falls installiert – sonst weiterhin die Webseite.
- **Zahlungen:** Trinkgeld für eine real erbrachte Dienstleistung außerhalb der App
  (wie bei Liefer- und Fahrdienst-Apps) läuft über Stripe/Apple Pay, nicht über In-App-Käufe.
  Vor der Einreichung gegen die aktuellen App-Review-Richtlinien (Abschnitt 3.1) prüfen und
  im Review-Hinweis erklären.
- **Datenschutzangaben:** Apple „App Privacy“ und Google „Data safety“ ausfüllen
  (erhoben: E-Mail, Name, optional Foto und Telefon; Zahlungsdaten nur beim Dienstleister).
- **Konto löschen in der App** – Pflicht bei Apple; Funktion existiert, API-Route ergänzen.
- **Sign in with Apple** – nur Pflicht, wenn andere Social Logins angeboten werden.
- **Berechtigungstexte:** Kamera („Zum Scannen von Lieferdank-Codes“), Fotos („Für dein
  Profilbild“), Mitteilungen.
- **Store-Material:** Icon 1024 × 1024, Screenshots (6,9″ und 6,5″ iPhone, Android Phone),
  Beschreibung, Datenschutz-URL (`https://lieferdank.de/legal/datenschutz`), Support-URL.
- **Testen:** TestFlight (iOS) und interner/geschlossener Test (Android).

### Reihenfolge

1. Web-App im Feldtest mit echten Lieferanten (heute möglich)
2. PWA-Nutzung beobachten: Wie viele installieren Lieferdank auf dem Home-Bildschirm?
3. Lieferanten-App zuerst (Karte, Einnahmen, Push bei Trinkgeld)
4. Kunden-App danach – der Scan im Browser funktioniert ohnehin

Push-Benachrichtigungen („Du hast ein Danke bekommen“) sind der stärkste Grund für eine
native Lieferanten-App. Web-Push auf iOS funktioniert nur für installierte PWAs und ist
weniger zuverlässig.
