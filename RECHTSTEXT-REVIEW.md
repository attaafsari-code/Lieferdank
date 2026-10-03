# Rechtstexte – Entscheidungsprotokoll

Stand: 03.10.2026. Grundlage: der implementierte Code und Primärquellen (gesetze-im-internet.de,
EUR-Lex bzw. Normtexte, Vertragsseiten der Dienstleister). Keine Rechtsberatung; eine anwaltliche
Durchsicht vor dem Start mit echten Zahlungen bleibt empfehlenswert.

## Erledigt

| Nr. | Thema | Entscheidung | Grundlage |
| --- | --- | --- | --- |
| 1 | Haftung (AGB Ziff. 10) | Unbeschränkt bei Vorsatz, grober Fahrlässigkeit, Leben/Körper/Gesundheit, ProdHaftG, Garantie; bei leichter Fahrlässigkeit nur für wesentliche Vertragspflichten, begrenzt auf den vorhersehbaren Schaden; Gewährleistung für digitale Dienstleistungen bleibt unberührt | § 309 Nr. 7 a/b BGB, § 307 BGB, §§ 327 ff. BGB |
| 2 | Recht und Gerichtsstand (Ziff. 14) | Deutsches Recht mit Verbrauchervorbehalt; keine Gerichtsstandsvereinbarung, da der Betreiber kein Kaufmann ist | Art. 6 Abs. 2 Rom-I-VO; § 38 ZPO |
| 3 | Erstattungen (Ziff. 6) | Ermächtigung von Lieferdank nur bei doppelter/irrtümlicher, betrügerischer oder nicht autorisierter Zahlung oder auf Verlangen des Zustellers; Information per E-Mail (technisch umgesetzt: `refundNotice`) | § 307 BGB (Transparenz, Angemessenheit) |
| 4 | Einordnung und Widerrufsrecht | Trinkgeld = freiwillige Zuwendung an den Zusteller; für Sender ist Lieferdank kostenlos (kein Widerrufsrecht mangels Preis). Für Zusteller ist die Trinkgeld-Funktion entgeltlich (Gebühr je Trinkgeld); angestellte Zusteller sind Verbraucher. Umgesetzt: Pflichtinformationen vor dem Klick, Schaltfläche „Trinkgeld zahlungspflichtig aktivieren“, ausdrückliches Verlangen des Sofortbeginns, Vertragsbestätigung mit Widerrufsbelehrung und Muster-Formular per E-Mail, Online-Widerrufsfunktion, Kündigungsschaltfläche | § 13, § 312 Abs. 1, § 312f Abs. 2, § 312j Abs. 2–4, § 312k, § 356a, § 357a Abs. 2 BGB; Art. 246a EGBGB mit Anlagen 1 und 2 |
| 5 | Mindestalter (Ziff. 3) | Konten ab 18 Jahren; Bestätigung in der Registrierungs-Checkbox | Vertragsfreiheit; Stripe verlangt für Minderjährige einen gesetzlichen Vertreter |
| 6 | AGB-Änderungen (Ziff. 12) | Nur mit ausdrücklicher Zustimmung, Ankündigung vier Wochen vorher per E-Mail; keine Zustimmungsfiktion | BGH, Urteil vom 27.04.2021 – XI ZR 26/20 |
| 7 | Nachrichten und Meldungen (Ziff. 8) | Inhaltsregeln, keine Vorabprüfung, menschliche Entscheidung, Melde- und Abhilfeverfahren mit Empfangsbestätigung (`/kontakt?anliegen=meldung`), Begründung bei Maßnahmen | Art. 14, 16, 17 DSA; Art. 19 DSA (Kleinstunternehmen nur von Abschnitt 3 befreit) |
| 8 | Rollen | Lieferdank Verantwortlicher; Stripe Auftragsverarbeiter des Zahlungsempfängers und eigener Verantwortlicher für eigene Zwecke; der Zusteller sieht als Zahlungsempfänger Zahlungsangaben in seinem Stripe-Konto | Stripe DPA und Datenschutzerklärung |
| 9 | Speicherdauer und Rechtsgrundlagen | Je Verarbeitung festgelegt; Buchungsdaten 8 Jahre (Bücher 10), Korrespondenz bis 6 Jahre, Protokolle 12 Monate, Reset-Links 30 Tage (automatisch per täglichem Cron `/api/cron/aufbewahrung`); Danke, Nachrichten, Scans u. a. werden bei Kontolöschung gelöscht | Art. 5 Abs. 1 lit. e, Art. 6, Art. 13 DSGVO; § 147 Abs. 3 AO |
| 10 | Cookies | Nur unbedingt erforderliche Cookies, einwilligungsfrei | § 25 Abs. 2 Nr. 2 TDDDG |
| 11 | Drittlandtransfer | DPF für Stripe, Vercel, Resend (nach eigenen Angaben zertifiziert), sonst Standardvertragsklauseln (Supabase) | Art. 45 DSGVO i. V. m. Durchführungsbeschluss (EU) 2023/1795; Art. 46 Abs. 2 lit. c DSGVO |
| 12 | Zweiter Kontaktweg | Kontaktformular `/kontakt` mit Antwort per E-Mail; zugleich zentrale Kontaktstelle (Deutsch/Englisch) | § 5 Abs. 1 Nr. 2 DDG; EuGH, Urteil vom 16.10.2008 – C-298/07; Art. 11, 12 DSA |
| 14 | Verbraucherstreitbeilegung | Erklärung beibehalten; Hinweis auf die OS-Plattform entfällt (Plattform seit 20.07.2025 abgeschaltet) | § 36 VSBG; Verordnung (EU) 2024/3228 |

Aufsichtsbehörde (Datenschutz): Landesbeauftragter für den Datenschutz und die Informationsfreiheit
Baden-Württemberg, Heilbronner Straße 35, 70191 Stuttgart (Anschrift seit 22.12.2025).

## Offen – braucht Angaben oder Handlungen des Betreibers

1. **Telefonnummer** (Nr. 4): Für Verbraucherverträge im Fernabsatz Pflichtangabe
   (Art. 246a § 1 Abs. 1 Nr. 3 EGBGB) und Teil des Widerrufsmusters. Eintragen in
   `src/lib/legal-content.ts` (`OPERATOR.phone`); dann verschwindet der Entwurfshinweis auf den AGB
   automatisch und die Nummer erscheint in AGB, Impressum, Widerrufsbelehrung und Vertragsbestätigung.
2. **Vercel-Tarif** (Nr. 11): Hobby ist laut Vercel nur für nicht-kommerzielle Nutzung erlaubt
   („any method of requesting or processing payment“ gilt als kommerziell), und der
   Auftragsverarbeitungsvertrag gilt nur für Pro und Enterprise. Vor echten Zahlungen auf Pro wechseln.
3. **IONOS-AV-Vertrag** (Nr. 11): Seit 19.07.2022 Teil der IONOS-AGB; ist der Vertrag älter, im
   Kundenbereich unter „Datenschutz“ abschließen. Supabase, Resend und Stripe binden ihren AV-Vertrag
   automatisch ein.
4. **Betreiberstatus** (Nr. 13): Gewerbeanmeldung und steuerliche Behandlung der Gebühren klären.
   Falls eine USt-IdNr. oder Wirtschafts-Identifikationsnummer vorhanden ist, gehört sie ins Impressum
   (§ 5 Abs. 1 Nr. 6 DDG).
