# LieferDank – Abschlussbericht iOS-Release (15.10.2026)

Historischer Stand von Build 9. Die nachfolgenden V1-Änderungen und aktuellen Testgrenzen sind in [der Abnahme vom 15./16. Oktober](mobile/V1-ACCEPTANCE-20261015.md) dokumentiert; insbesondere ist die freiwillige Newsletter-Anmeldung inzwischen verfügbar.

**Entscheidung: NO-GO für „Zur Prüfung einreichen“ – es fehlen nur noch drei persönliche Angaben bzw. Tests.**
Alles Technische ist erledigt und in App Store Connect hinterlegt. Apple lässt die Einreichung erst zu, wenn eine Telefonnummer für den Review-Kontakt und ein Review-Testkonto eingetragen sind. Beides kann nur der Betreiber liefern (siehe Abschnitt „Nur durch dich“).

## Stand in App Store Connect (geprüft am 15.10.2026, 01:45 Uhr)

| Punkt | Stand |
|---|---|
| App | LieferDank, App-ID 6821075305, Bundle `de.lieferdank.driver`, Team 66V45RP7TP, Primärsprache Deutsch |
| Build | **1.0.0 (9)**, Commit `8feece0`, verarbeitet (VALID), Exportkontrolle: keine nicht-befreite Verschlüsselung |
| TestFlight | Build 9 in der internen Gruppe „LieferDank Intern“, Status „In Beta-Test“; 1 interner Tester |
| Version 1.0.0 | Build 9 zugeordnet, Status „Bereit zur Einreichung vorbereiten“ |
| Store-Eintrag (de-DE) | Name, Untertitel „Trinkgeld & Danke an der Tür“, Beschreibung, Keywords, Support-/Datenschutz-/Marketing-URL, Versionshinweise, Copyright |
| Kategorien | Wirtschaft (primär), Lifestyle |
| Screenshots | 6 echte App-Screenshots (6,9 Zoll, 1320 × 2868) aus dem Simulator mit Beispieldaten eines lokalen Testservers |
| Altersfreigabe | 4+, alle Fragen „keine“ |
| Inhaltsrechte | keine Inhalte Dritter |
| Preis / Verfügbarkeit | kostenlos, nur Deutschland (neue Länder nicht automatisch) |
| App-Datenschutz | veröffentlicht: Name, E-Mail, Fotos, Nutzerinhalte, Benutzer-ID, Geräte-ID (Push-Token), sonstige Finanzinfos (erhaltene Trinkgelder); jeweils für App-Funktionalität, mit dir verknüpft, kein Tracking |
| Review-Angaben | Notizen fertig (Zahlungen, Nutzerinhalte, Kontolöschung) in `apps/driver/store/review.json`; **Telefonnummer und Testkonto fehlen** |
| Künftige Uploads | App-Store-Connect-API-Key bei EAS hinterlegt, `ascAppId` in `eas.json` – nächste Builds laufen ohne Apple-Anmeldung |

## Was in dieser Release-Runde behoben und gebaut wurde

- **Login-Fehler der App:** Ursache war die iOS-Großschreibung des ersten Passwortbuchstabens und Autokorrektur im E-Mail-Feld. Behoben; alle Webkonten (Kunde, Zusteller, Admin) melden sich nativ an, Admin-Rechte bleiben ausschließlich im Web.
- **Schutz vor missbräuchlichen Nachrichten (Guideline 1.2):** Filter für Links, Kontaktdaten und schwere Beleidigungen; Melden in der App (sofort ausgeblendet, Prüfung im Adminbereich); Absender blockieren, ohne Identität offenzulegen; Datenschutztext ergänzt.
- **Push:** wird nur angeboten, wenn `PUSH_ENABLED` aktiv ist. Bei EAS ist kein Apple-Push-Schlüssel hinterlegt; Push ist für Version 1.0 deshalb aus. Keine Pflichtfunktion hängt davon ab.
- **Ehrliche Mail-Meldungen:** Registrierung, Bestätigungsmail und Formular-Quittungen melden fehlgeschlagenen Versand.
- **Newsletter:** Double-Opt-in technisch vorbereitet, abgeschaltet bis es einen Newsletter gibt; Widerruf jederzeit.
- **Meilensteine:** 100 bis 10.000 Danke, dauerhaft gespeichert, ohne Doppelvergabe, je Gerät höchstens eine Mitteilung.
- **Design:** Logo komplett blau mit Herz ohne Rand (Web, App, Icon, Karte), native Kartenvorschau, kompakte Login-Seite mit Rechtstexten im In-App-Blatt, jeder Screen startet oben.
- **Sicherheit:** App-Token öffnet keine Web-Sitzung mehr; eine ohne Anmeldung aufrufbare Datenbankfunktion gesperrt; alle neuen Tabellen mit RLS „alles verboten“ und nur serverseitigem Zugriff.

## Tests und Nachweise

| Prüfung | Ergebnis |
|---|---|
| Backend-Tests | 435/435 grün |
| App-Tests, TypeScript, ESLint | 35/35 grün, fehlerfrei |
| Web-Build, CI (`validate`, `driver-app`) | grün |
| Production nach Deployment | Health ok (Supabase, Stripe, Resend, Auth), neue Routen live |
| E-Mail | Echte Mail aus Production an ein externes Testpostfach zugestellt, SPF und DKIM bestanden. Getestet über die Kontaktformular-Quittung (gleicher Absender und Versandweg wie der Passwort-Reset). |
| Simulator | Alle Zusteller-, Kunden- und Login-Screens geprüft; Registrierung, Melden/Blockieren, Kartenvorschau |
| Nicht real geprüft | Login mit deinem echten Konto auf deinem iPhone; Empfang einer Passwort-Reset-Mail in deinem Postfach; Live-Zahlung (bewusst nicht) |

## Nur durch dich (persönlich, nicht automatisierbar)

1. **Telefonnummer für den App-Review-Kontakt** in App Store Connect → App → Version 1.0.0 → „App-Prüfungsinformationen“ eintragen (nur für Apple sichtbar, nicht öffentlich). Ich darf keine Nummer erfinden.
2. **Review-Testkonto anlegen:** in der App ein Zusteller-Konto registrieren (z. B. `review@lieferdank.de`), die E-Mail bestätigen, und Benutzername/Passwort im selben Formular eintragen. Ich lege keine Konten in Production an. Die Review-Notizen aus `apps/driver/store/review.json` dort einfügen, falls nicht schon vorhanden.
3. **Gerätetest:** TestFlight öffnen, Build 9 installieren, mit deinem Konto anmelden und einmal „Passwort vergessen“ auslösen (Postfach und Spam prüfen).
4. **Einreichung freigeben:** Danach in App Store Connect „Zur Prüfung einreichen“. Ohne deine ausdrückliche Zustimmung reiche ich nichts öffentlich ein.

Empfehlungen ohne Release-Bedeutung, nur mit deiner Freigabe: DMARC auf `p=quarantine` und 2048-Bit-DKIM bei IONOS; Apple-Push-Schlüssel anlegen, wenn Push kommen soll.

## Kosten (Listenpreise, nicht mit Rechnungen geprüft)

Plattformgebühr 0,50 € / 0,60 € / 1,00 € bei 2 € / 3 € / 5 €. Fixkosten ca. 30–55 € pro Monat (Vercel Pro, Supabase, Apple Developer, Domain; Resend und EAS im kostenlosen Rahmen). Break-even bei ca. 50–92 Trinkgeldern pro Monat.

## Commits und Deployments

`f38ee05`, `bb78dd6` (PR #1), `d51e237` (PR #2, Production deployt, Migration eingespielt), `8feece0` und der Store-Stand in diesem Bericht (PR #3). Production: https://lieferdank.de.
