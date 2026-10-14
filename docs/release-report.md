# LieferDank – Release-Bericht iOS (14.10.2026)

**Entscheidung: NO-GO für die öffentliche Einreichung – noch nicht.**
Der Code ist deployt und der signierte iOS-Build 1.0.0 (7) ist bei EAS fertig gebaut. Es fehlen Nachweise, die nur mit dir möglich sind: ein echter Login-Test mit deinem Admin- bzw. Zustellerkonto auf dem iPhone, der Empfang einer Passwort-Reset-Mail in einem echten Postfach und der TestFlight-Upload (Abschnitt 15). Danach ist aus technischer Sicht nichts Bekanntes mehr offen außer den App-Store-Metadaten.

## 1. Tatsächlich behobene Fehler

| Fehler | Ursache (belegt) | Behebung |
|---|---|---|
| Webkonten scheitern in der App mit „E-Mail oder Passwort ist falsch“ | Das Passwortfeld der App schrieb den ersten Buchstaben automatisch groß (iOS-Autokapitalisierung), das E-Mail-Feld hatte Autokorrektur an. Server und Passwortprüfung sind für Web und App identisch (`src/server/services/auth.ts`); per curl gegen Production antwortet der Login-Endpunkt korrekt. | Eingabefelder ohne Autokorrektur, Passwort/E-Mail ohne Großschreibung, mit iOS-Inhaltstypen für Passwort-Autofill (`apps/driver/src/ui.tsx`, `App.tsx`) |
| Admin- und Kundenkonten konnten sich in der App gar nicht anmelden | Server lehnte alle Nicht-Zusteller mit `driver_only` ab | Alle drei Rollen melden sich nativ an; rollenabhängige Navigation |
| „E-Mail gesendet“, obwohl nichts verschickt wurde | Bestätigungsmail meldete immer Erfolg | Server meldet dem angemeldeten Inhaber ehrlich, wenn der Mailanbieter ablehnt (Web und App) |
| Kartenvorschau in der App leer | Druck-SVG in Millimetern, vom nativen Renderer nicht darstellbar | Karte wird nativ gezeichnet (`CardPreview`) |
| QR-Seite brauchte einen zusätzlichen Tipp | – | QR lädt beim Öffnen |
| Logo mit dunkler Außenlinie und weißem Herzrand | – | Paket komplett blau, Herz ohne Rand, transparent; gleich auf Web, App, App-Icon und Karte |

## 2. Vollständig implementiert

- **Rollen in der App:** Zusteller (Übersicht, Einnahmen, QR-Code mit Kartenvorschau, Danke, Profil, Auszahlung, Einstellungen), Kunde (Zusteller per Code speichern/entfernen, Danke-Seite öffnen, eigener Verlauf, Konto), Admin (Anmeldung, Hinweis und Sprung zur Web-Administration, Konto). Registrierung in der App für Zusteller und Kunden. Admin-Konten können in der App weder registriert noch gelöscht werden.
- **Sicherheit Admin:** App-Gerätetokens werden von Web-Cookie-Sessions abgelehnt (`src/server/session.ts`). Ein kopiertes App-Token öffnet nie den Web-Adminbereich.
- **Login-Seite:** kompakte Fußzeile Datenschutz · AGB · Impressum · Hilfe; Rechtstexte öffnen als In-App-Blatt, nicht in Safari. Stripe-Onboarding bleibt bewusst bei Stripe.
- **Meilensteine:** Danke-Stufen 1, 10, 50, 100, 500, 1.000, 2.000, 3.000, 5.000, 10.000. Zählgrundlage: Anzahl erhaltener Danke (`thank_yous`, inklusive Danke mit Trinkgeld). Gespeichert in `milestones` mit Unique-Constraint (driver, type, value), daher keine Doppelvergabe. Ab 100 Danke (und beim Betragsmeilenstein) genau eine Push-Mitteilung je Gerät (Event-Key-Dedup). Anzeige im Dashboard. Keine Prämien versprochen.
- **Mail-Nachverfolgung:** Jede vom Anbieter angenommene Mail wird mit der Resend-Message-ID protokolliert (ohne Adresse und Inhalt), Ablehnungen mit dem Fehlernamen des Anbieters.

**Nicht implementiert (bewusst):** Newsletter-Einwilligung mit Double-Opt-in. LieferDank verschickt keinen Newsletter; eine Einwilligung einzusammeln, die nie genutzt wird, ist datenschutzrechtlich schlechter als keine. Umsetzung, sobald es einen Newsletter gibt (eigene Tabelle `marketing_consents`, DOI-Mail, Widerruf in den Einstellungen).

## 3. Real getestet

| Prüfung | Ergebnis |
|---|---|
| Backend-Tests (Vitest) | 417/417 grün, darunter neue Tests für Kunden-/Admin-Login, Admin-Löschsperre, Groß-/Kleinschreibung der E-Mail, gesperrte Konten, Kunden-Registrierung, Rollen-Injection, Meilenstein-Push-Dedup |
| App-Tests | 35/35 grün, TypeScript und ESLint der App grün |
| Web | Typecheck, Lint (0 Fehler), Production-Build grün; GitHub-CI `validate` und `driver-app` grün |
| iOS-Simulator (iPhone 17 Pro, lokale API mit Speicher-DB) | Login, Registrierung Zusteller/Kunde, Passwort vergessen, Dashboard, Einnahmen, QR mit Kartenvorschau, Danke, Profil, Auszahlung, Einstellungen, Kundenbereich und Verlauf visuell geprüft; eigene Testkonten nur lokal |
| Production nach Deployment | `/api/health` ok (Supabase, Stripe, Resend, Auth), neue Routen live (401 statt 404), Login-Validierung 400/401 korrekt, Rechtsseiten 200, `/admin` leitet um, neues Logo ausgeliefert, Universal-Link-Datei korrekt |

**Nicht real getestet:** Login mit deinem echten Konto auf einem echten iPhone, Push auf echtem Gerät, Zahlung in Production (keine Live-Zahlung ohne Freigabe).

## 4. Registrierung, Login, Passwort-Reset, E-Mail

- **Login und Registrierung:** behoben und getestet (Unit, Simulator, Production-Endpunkt). Echter Test mit deinem Konto steht aus.
- **E-Mail-Kette:** Resend ist konfiguriert, DNS ist korrekt (DKIM `resend._domainkey`, SPF über `send.lieferdank.de`, DMARC `p=none`, MX bei IONOS). In der Production-Datenbank sind keine Versandfehler protokolliert; am 13.10. wurden drei Reset-Links angefordert. Stand: Anfrage angenommen – ja; Versand vom Anbieter bestätigt – bisher nicht nachweisbar (wurde nicht protokolliert, ab jetzt schon); Zustellung ins Postfach – nicht nachgewiesen. Ohne Fehlerprotokoll ist die wahrscheinlichste Ursache Spam-Filterung beim Empfänger. Die Resend-Logs konnte ich nicht lesen (kein Zugriff auf Schlüssel oder Vercel-Logs).
- **Account-Enumeration:** „Passwort vergessen“ antwortet immer gleich.

## 5. Kunden-, Zusteller-, Admin-Konten

Alle drei Rollen funktionieren in Tests und gegen Production-Endpunkte; Admin-Rechte bleiben ausschließlich im Web. Echter Gerätetest mit deinem Admin-Konto offen.

## 6. QR, Trinkgeld, Stripe Connect, Auszahlungen

Unverändert gegenüber dem geprüften Stand (Standard Accounts, Direct Charges, `application_fee_amount`, idempotente Webhooks, Refunds). In diesem Durchgang keine Zahlungslogik geändert; Tests dazu grün. Keine Live-Zahlung durchgeführt.

## 7. iOS-Design

Alle Screens im Simulator geprüft und überarbeitet (Header, Logo, Karten, Bottom-Navigation mit Safe Area, Schalter, Fehler- und Hinweisboxen, Leerzustände; keine abgeschnittenen Texte in den geprüften Zuständen). Nur helles Erscheinungsbild (bewusst). Kleine Displays (iPhone SE) nicht separat geprüft.

## 8. Newsletter, Benachrichtigungen, Meilensteine

Meilensteine und Push-Logik: implementiert und getestet. Newsletter: nicht implementiert (siehe 2). Push auf echtem Gerät: nicht geprüft; ob ein APNs-Schlüssel in EAS hinterlegt ist, konnte ich nicht einsehen.

## 9. Sicherheit und Last

Neu: App-Token ist keine Web-Session, Admin-Löschsperre in der App, Rollen-Injection bei der Registrierung getestet, keine Mailadressen oder Inhalte in Protokollen. Secret-Scan des Diffs: kein Fund. Keine Lasttests auf Production (bewusst).

## 10. Kosten (Annahmen gekennzeichnet)

Plattformgebühr laut Code: 0,50 € bei 2 €, 0,60 € bei 3 €, 1,00 € bei 5 €. Bei Direct Charges mit Standard-Konten trägt der Zusteller die Stripe-Gebühr; LieferDank erhält die Plattformgebühr ohne eigene Transaktionskosten (*Annahme nach dem Stripe-Standardmodell, nicht mit Rechnung belegt*).

| Trinkgeld | LieferDank | Stripe (Annahme 1,5 % + 0,25 €) | Zusteller netto |
|---|---|---|---|
| 2 € | 0,50 € | 0,28 € | 1,22 € |
| 3 € | 0,60 € | 0,30 € | 2,10 € |
| 5 € | 1,00 € | 0,33 € | 3,67 € |

Fixkosten pro Monat (*Listenpreise, nicht mit Rechnungen geprüft*): Vercel Pro ca. 20 $, Supabase 0–25 $, Resend 0 $ (bis 3.000 Mails), Apple Developer ca. 8 € (99 $/Jahr), Domain ca. 1 €, EAS 0 $ (Free-Tier). Summe ca. 30–55 €. Break-even bei durchschnittlich 0,60 € Gebühr: **ca. 50–92 Trinkgelder pro Monat**. Risiko: Erstattungen und Disputes, falls die Plattformgebühr dabei zurückgezahlt wird.

## 11. Commits und Deployments

- `f38ee05` Webkonten aller Rollen in der App, ehrliche Mail-Statusmeldung
- `bb78dd6` App für alle Rollen neu aufgebaut, iOS-Eingabefelder behoben, neues Logo, Meilensteine
- PR https://github.com/attaafsari-code/Lieferdank/pull/1 gemergt als `4dbd686`; Vercel-Production-Deployment erfolgreich

## 12. iOS-Build

EAS-Build `4961f554-f706-491b-8a45-01fb7c656bd8`, Version 1.0.0 (Build 7), Commit `bb78dd6`, Profil production, Team 66V45RP7TP, Status bei EAS: **fertig gebaut und signiert**. **Nicht zu App Store Connect hochgeladen:** Die automatische Übermittlung brach ab, weil in `eas.json` keine `ascAppId` hinterlegt ist; weitere Übermittlungsschritte wurden von der Sicherheitsfreigabe dieser Sitzung blockiert.

## 13. Apple-Metadaten

Nicht vorbereitet: Screenshots, Beschreibung, Keywords, App-Privacy-Angaben, Review-Notes und Review-Testkonto. Hinweise:
- Account-Löschung ist in der App vorhanden (Guideline 5.1.1(v)).
- Sign in with Apple ist nicht nötig, da kein Drittanbieter-Login angeboten wird.
- Trinkgeld: Die App selbst nimmt keine Zahlungen an; Kunden zahlen auf der Website für eine real erbrachte Zustellleistung. Meine Einschätzung, keine Zusage: Das fällt unter Zahlungen für außerhalb der App erbrachte Dienste (Guideline 3.1.3(e)), nicht unter In-App-Kauf. Genau diese Erklärung gehört in die Review-Notes.

## 14. Nicht abgeschlossen und warum

1. TestFlight-Upload: `ascAppId` fehlt, Übermittlung in dieser Sitzung gesperrt.
2. Nachweis der Mailzustellung: braucht ein echtes Postfach und Einsicht in Resend.
3. Echter Gerätetest (Login, Push): nur mit deinem iPhone.
4. Newsletter mit Double-Opt-in: bewusst nicht gebaut (siehe 2).
5. App-Store-Metadaten und Screenshots.

## 15. Nur durch dich

1. Build 7 an App Store Connect übermitteln: in `apps/driver` mit EAS-CLI 24.12 den Befehl `submit --platform ios --latest` ausführen (fragt einmal nach dem Apple-Login), oder die App-ID in `eas.json` unter `submit.production.ios.ascAppId` eintragen, dann übernehme ich das.
2. In TestFlight installieren und mit deinem Admin- und einem Zustellerkonto anmelden.
3. „Passwort vergessen“ für deine Adresse auslösen, Postfach inklusive Spam prüfen; im Resend-Dashboard den Status der Mail ansehen.
4. Mitteilungen in den App-Einstellungen einschalten; prüfen, ob in EAS ein APNs-Schlüssel hinterlegt ist.
5. App-Store-Metadaten, Screenshots, Datenschutzangaben und Review-Testkonto anlegen; danach Einreichung freigeben.

## 16. Bereit für die öffentliche Einreichung?

**NO-GO**, mit diesen nachgewiesenen Blockern: kein Build in App Store Connect, kein echter Gerätetest des Logins, keine nachgewiesene Mailzustellung, keine App-Store-Metadaten.
