# Store-Vorbereitung (Entwurf; keine Einreichung)

Name: LieferDank
Untertitel / Kurzbeschreibung: Dein Einsatz verdient ein Danke.
Kategorie-Vorschlag: Dienstprogramme (Apple) / Tools (Google).
Beschreibung: Die LieferDank-App ist für Paketzusteller. Zeige deinen persönlichen Danke-Code, sieh erhaltene Danksagungen und Nachrichten und behalte Trinkgelder im Blick. Kunden benötigen keine App. Zahlungseinrichtung und Auszahlungen erfolgen direkt bei Stripe. Trinkgeld ist freiwillig; bei Trinkgeldern fallen die angezeigten LieferDank- und gesonderten Stripe-Kosten an.
Keywords-Vorschlag: Zusteller, Paket, Danke, Wertschätzung, Trinkgeld, QR
Support: https://lieferdank.de/kontakt
Datenschutz: https://lieferdank.de/legal/datenschutz
Marketing: https://lieferdank.de
AGB: https://lieferdank.de/legal/agb

Review Notes: Native Fahrer-App, keine Kundenzahlungen in der App. Reale Zustelldienstleistungen außerhalb der App; Stripe-Standard-Account-Onboarding im Systembrowser. Kein digitaler Inhalt, kein Abonnement/In-App-Kauf, kein Social Login. Ein vorhandenes Konto ist nicht nötig für den Web-Kundenflow. In-App-Kontolöschung vorhanden, finanzielle Aufbewahrungsregeln können eine manuelle Klärung bei offenen Zahlungen erfordern. Benutzerhinweise, API und Support sind zugänglich. Review-Zugang separat bereitstellen und mit Apple/Google testen.

Vorläufige Dateninventur (keine erfundenen Store-Angaben):
- Name, E-Mail, optional Telefon, Profiltext: kontogebunden, App-Funktionalität.
- Optionales Profilfoto: Nutzerwahl; privat/öffentlich gemäß Einstellung.
- Trinkgelder und Erstattungsstatus: kontogebundene Finanz-/Transaktionsdaten; Stripe verarbeitet Bank-/KYC-Daten außerhalb der App.
- Danke-/Kundennachrichten: nutzergenerierte Inhalte, Anzeige beim Empfänger.
- App-Sitzungs-ID/Push-Token: kontogebundene Gerätekennungen für sichere Sitzung/Benachrichtigungen, Expo/APNs/FCM als Zustellanbieter.
- Server-Sicherheits-/Fehlerprotokolle: bestehende Minimierung und Fristen prüfen.
- Kein Advertising SDK, kein ATT/Tracking, keine Kontakte/Standort/Mikrofon/Kamera erforderlich. Keine Aussage über fremde Systembrowser-Websites ohne gesonderte Prüfung.

Privacy Labels / Data Safety müssen diese Sammlung als kontogebunden berücksichtigen. Datenverschlüsselung in Transit HTTPS; Account-Löschung über App und Web-Konto. Google-Löschlink: https://lieferdank.de/app/konto-loeschen ; vor Einreichung mit ausgeloggter Sitzung prüfen. Alters-/Content-Fragebogen ehrlich wegen nutzergenerierter Nachrichten ausfüllen, keine erfundene Altersfreigabe. Melden-/Entfernen-Funktionen für anonyme Nachrichten und Support vor Review ausführen. Finanz-App-Erklärung nach Play-Fragebogen am tatsächlichen Trinkgeld-/Stripe-Modell ausrichten.

Screenshots erst aus funktionierendem Simulator/Gerät: Übersicht, Einnahmen, Danke, QR, Profil. Keine erfundenen App-Screenshots oder echten personenbezogenen Daten verwenden. Icon/Adaptive Icon aus bestehendem LieferDank-Markenasset; Schrift mit OFL-Lizenz.
