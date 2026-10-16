# Native Kartenbearbeitung – 16. Oktober 2026

Die QR-Code-Ansicht bietet „Karte bearbeiten“ mit drei vorhandenen Layouts, den gemeinsamen Farben Blau/Nachtblau/Petrol, persönlichem Kartentext, Profilfoto und sofortiger Vorschau. Die App verwendet die beiden reinen Module `src/lib/card/design.ts` und `svg.ts`; keine zweite Kartenvorlage. Der SVG-Renderer nutzt explizite Gruppentransformationen statt verschachtelter SVG-Viewports, damit native Vorschau, Web und Exporte übereinstimmen. XML-Text wird nur nach dem Parsen für die native Darstellung decodiert, niemals vor dem Parsen entsichert.

`GET/PATCH /api/v1/me/card` verwendet ausschließlich das Zustellerprofil der Bearer-Session. Der Client kann keinen fremden Besitzer, Code oder eine Foto-URL bestimmen. Validierte Layouts/Farben und der bestehende Textgrenzwert werden serverseitig erzwungen. Die `updatedAt`-Revision schützt neue Web-/App-Speichervorgänge per bedingtem DB-Update vor gegenseitigem Überschreiben; bei Konflikt bleibt der lokale Entwurf erhalten und der Nutzer kann den aktuellen Stand laden. Alte Clients ohne Farbfeld bleiben kompatibel.

Fotoauswahl und -Upload verwenden die vorhandene Profilfoto-API samt serverseitiger Normalisierung. Fotoänderungen werden unmittelbar im Profil gespeichert; die Foto-Freigabe für die öffentliche Danke-Seite bleibt eine separate Einstellung. PDF-Erstellung, Files-/Sharing-Menü und AirPrint behalten ihren bestehenden nativen Ablauf und ihr A4-/Kartenformat. Die QR-Identität ändert sich nicht.

## Schema und Deployment

Vor dem Backend-Deployment genau `supabase/migrations/20261016150455_card_design_color.sql` auf dem verifizierten LieferDank-Projekt ausführen. Additiv: `color text NOT NULL DEFAULT 'blue'`, zugelassene Werte per CHECK; keine Löschung, keine neue Tabelle, keine Änderung an RLS oder Zahlungsdaten. Isoliert mit PostgreSQL/PGlite wiederholt getestet: vorhandene Daten bleiben erhalten, Standardfarbe wird gefüllt, ungültige Farbe wird zurückgewiesen, RLS unverändert. Health prüft die neue Spalte. Keine älteren Migrationen erneut ausführen oder bestehende Migrationshistorie pauschal reparieren.

Das EAS-Archiv enthält die App und ausschließlich die beiden reinen gemeinsamen Kartenmodule. Keine Web-/Backenddateien, Umgebungsdateien, Signierschlüssel oder lokalen Testdaten hinzufügen. Erst nach grünem Backend-Deployment/Health den neuen Production-iOS-Build erstellen; vorhandene Signiercredentials und TestFlight-Gruppe „LieferDank Intern“ verwenden. Keine öffentliche Store-Einreichung.

## Abnahme

- Automatisiert: Auth/Ownership, Feldvalidierung, ungültiges JSON, paralleles Speichern, veraltete Revision, historische Designs, Wiederöffnen, alle neun Layout-/Farbkombinationen, gemeinsamer Web-/App-Renderer, private Fotoeinbettung, feste Markenfarben, QR-Decodierung und PDF-HTML-Sicherheit.
- Tatsächlich im iOS-26.5-Simulator: Editor geöffnet, Layout/Farbe/Text geändert und gespeichert; persistierte Daten per HTTP bestätigt; Live-SVG einschließlich Foto und korrigierter Textdarstellung visuell geprüft.
- Tatsächlich im Browser: dasselbe gespeicherte Design geöffnet, Farbe/Text geändert und erfolgreich gespeichert. Zusätzlich 10/10 isolierte HTTP-Prüfungen für Design, Foto und Synchronisations-/Fehlerfälle.
- Die heutige Simulator-Aktionssteuerung wurde wiederholt extern unterbrochen (`noWindowsAvailable`), obwohl die Vorschau sichtbar blieb. Erneutes Öffnen des nativen Files-/Teilen-/AirPrint-Dialogs konnte deshalb in dieser Runde nicht abgeschlossen werden. Keine physische Druckerabnahme behaupten. PDF-Speichern in Build 11 wurde vom Besitzer auf dem echten iPhone bestätigt; der native Exportablauf wurde nicht umgebaut.
- HawkScan nicht ausgeführt: CLI und API-Key fehlen. Keine Live-Zahlung oder Stripe-Änderung durch diese Erweiterung.
