# LieferDank V1 – Abnahme 15. Oktober 2026

## Implementierte Änderungen

- Eine Kundenidentität kann ein Zustellerprofil ergänzen. Die E-Mail, Benutzer-ID, Kundenhistorie und Favoriten bleiben erhalten. Profil-UNIQUE-Constraints entscheiden parallele Aktivierungen; Adminrechte sind ausgeschlossen. Beide Profile bleiben mit bestehenden Sitzungen erreichbar. Die App speichert die gewählte Ansicht im sicheren Gerätespeicher.
- Registrierungen normalisieren E-Mail-Adressen auch am Service-Eingang. Gleichzeitige Dubletten werden durch die bestehende Datenbank-UNIQUE-Regel zurückgewiesen, niemals zusammengeführt.
- Eigene kostenlose Danke und eigene Trinkgelder werden in Services, Web-Actions und öffentlicher API abgewiesen. Die API berücksichtigt dabei auch ein gültiges Web-Sessioncookie, ohne dadurch privaten API-Zugriff zu erlauben. Die eigene Webansicht und die native „Seite ansehen“-Funktion sind Vorschauen ohne Danke-/Trinkgeldaktionen oder Scan-Zählung.
- Ein kompakter Auszahlungshinweis führt zum bestehenden Einrichtungsablauf. Gebührenhinweise und ausdrückliche Zustimmung bleiben auf der Einrichtungsseite erhalten. Direct Charges, Standard-Konten, Application Fees, Webhooks und Refund-Logik wurden nicht umgebaut.
- Native PDF-Erstellung mit dem offiziellen `expo-print`: dieselbe autorisierte SVG-Karte, 85,6 × 54 mm auf A4, System-Teilen-Menü einschließlich Dateien und nativer AirPrint-Dialog. Ein Druckabbruch ist kein technischer Fehler.
- Freiwillige Newsletter-Anmeldung in Webkonto, Fahrerprofil und App-Einstellungen, ohne vorausgewählte Zustimmung. Zweckgebundene signierte Bestätigungslinks (7 Tage), gespeicherte Zeitpunkte/Quelle, Wiederanmeldung und explizite Abmeldung auch ohne Login. Bestätigen und Abmelden erfolgen erst durch POST. Veraltete Links können eine neue Anmeldung nicht verändern. Parallelkonflikte werden behandelt; fehlgeschlagener Mailversand wird nicht als Bestätigung ausgegeben.

## Testmatrix und Nachweise

Das Routeninventar umfasst 41 Seiten und 40 Route-Handler. Nicht jede Route wurde mit einem echten Production-Nutzer aufgerufen. Authentifizierte und finanzielle Abläufe werden deterministisch in isolierten Integrationstests geprüft; die reale HTTP-Prüfung verwendet ausschließlich lokale Wegwerfkonten ohne externe Provider-Keys.

| Bereich | Automatisiert geprüft | Tatsächlich im Simulator / über HTTP geprüft |
|---|---|---|
| Registrierung, Login, Verifizierung, Reset, Sessions, Sperren | Bestehende Auth-/Security-/Mobile-Tests; zusätzlich normalisierte parallele Dubletten | Nativer Kundenlogin mit isoliertem Testkonto; native Sitzung nach Neustart |
| Kunde → Zusteller / Berechtigungen | Gleichzeitige Aktivierung, eine Identität/ein Profil, Favoriten, alte Sitzung, manipulierte Benutzer-ID/Adminrolle, Löschung beider Profilbereiche | Aktivierungsformular, neuer Danke-Code, Dashboard, Rollenwechsel zurück zum erhaltenen Favoriten; Neustart behält Rolle |
| Danke / Nachrichten / Meilensteine | Bestehende Daily-Limit-, Grant-, Moderations-, Push- und Statistiktests; neu Eigen-Danke auch über Webcookie/API, Eigen-Trinkgeld | Eigene API-Anfrage 403; Kunden-Danke und tägliche Wiederholung; öffentliche Vorschau |
| Stripe / Geld / Erstattungen | Bestehende Checkout-, Standard-Connect-, Signatur-, Idempotenz-, Refund-/Dispute-Tests | Keine neue externe Zahlung oder Erstattung ausgelöst |
| QR / Karte / Export | Bestehende QR-Decodierung, Farben/Foto-Ownership; neu PDF-HTML/Sicherheit/Format und Druckabbruchklassifikation | Persönliche Vorschau; PDF im iOS-Teilen-Menü; AirPrint mit A4/1 Seite. Native PDF mit pdfinfo geprüft, gerendert und QR daraus erfolgreich decodiert |
| Newsletter | Explizites API-Opt-in, DOI, Ablauf, Zwecktrennung, alter Link, Abmeldung, Wiederanmeldung, Parallelität, Providerfehler | Einstellung nativ geöffnet: Zustimmung aus, Anfordern deaktiviert. Keine echten Newsletter-Mails versandt |
| Öffentliche Website / Legal / Hilfe | Build aller Seiten, vorhandene Formular-/Securitytests | 17 öffentliche Seiten einschließlich Rechtstexte/Newsletterseiten über HTTP erreichbar |
| Dashboard / Konto / Admin | Bestehende serverseitige Rollen- und Ownershiptests | 13 geschützte Webpfade leiten ohne Anmeldung um; 12 private API-GETs liefern 401 |
| Profil / Foto / Datenexport / Löschen / Push | Bestehende Mobile-, Upload-, Privacy-, Lösch- und Push-Tests; zusätzliche Löschung dualer Profile | Kein neuer Production-Nutzerzugriff, Foto-/Druckerhardware und reale Push-Zustellung in dieser Runde nicht abgenommen |
| PWA / Links / Infrastruktur | Bestehende PWA-/Link-/Runtime-/Health-/Deploy-Sicherheitstests und Production-Build | Sichere Production-Health-Abfragen; keine Stripe-Konfiguration geändert |

Abschlussgates vor Release: **450/450 Web-/Backendtests**, **38/38 App-Tests**, Typecheck in beiden Projekten erfolgreich, ESLint ohne Fehler (Root: eine Warnung in einer ignorierten lokalen `.remember`-Scratchdatei), Production-Build und iOS-Hermes-Export erfolgreich. Zusätzlich **51/51 echte isolierte HTTP-Prüfungen** und erfolgreicher nativer iOS-Debug-Build mit Expo Print. Keine externen Dienste durch diese Tests verändert.

## Sicherheitsgrenzen und externe Abnahmen

- Anonyme Besucher haben keine zuverlässige dauerhafte Personenidentität. Signierte Besucherkennung und tägliche DB-UNIQUE-Regeln verhindern normale Reload-/Mehrfachklickduplikate, nicht das bewusste Löschen von Cookies, einen anderen Browser oder ein anderes Gerät. Ein ausgeloggter Besitzer ist ebenfalls nicht sicher erkennbar. Kein Fingerprinting eingeführt.
- Keine neue Migration erforderlich: Nutzer-/Profil-UNIQUE-Regeln und `marketing_consents` aus `20261014120000_message_moderation.sql` werden wiederverwendet. Diese Runde führt keine Migration aus.
- Newsletter-Anmeldung ist standardmäßig verfügbar; `NEWSLETTER_ENABLED=false` kann neue Anmeldungen deaktivieren. Es gibt weiterhin keinen automatischen Marketingversandjob. Abmeldung bleibt möglich.
- npm-Audit der Web-Produktionsabhängigkeiten: 0 Befunde. Expo-/Metro-Buildtool-Kette: 14 High-Einträge (`braces` / `node-forge`, bereits zuvor vorhanden); angebotene Fixes wären inkompatible Major-Downgrades. Nicht als behoben oder als native Laufzeitexploit ausgegeben. HawkScan nicht ausgeführt: CLI und API-Key fehlen.
- AirPrint-Vorschau wurde geöffnet, aber kein physischer Druck durchgeführt. Zustellung im persönlichen Mailpostfach, reale Push-Zustellung und der neue TestFlight-Build auf einem echten iPhone sind gesonderte Geräte-/Providerabnahmen.
- App-Store-Review benötigt weiterhin echte Review-Kontaktangaben und einen sicheren Review-Zugang. Kein öffentlicher Store-Submit durch diesen Auftrag. Die freiwillige Newsletter-Nutzung muss in den App-Privacy-Verwendungszwecken der E-Mail-Adresse berücksichtigt sein.

Deployment- und TestFlight-Ergebnisse werden erst nach tatsächlich erfolgreichem Push/Build/Upload berichtet. Frühere Build-9-Ergebnisse sind kein Nachweis für den neuen Build.
