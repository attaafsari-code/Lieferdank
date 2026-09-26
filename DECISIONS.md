# Produktentscheidungen

Format je Eintrag: **Entscheidung · Grund · Vorteil · Risiko · Status**.

---

## 1. Trinkgeld beginnt bei 2 €, feste Gebühr von 0,50 €

**Entscheidung:** Die Buttons lauten 2 €, 3 €, 5 €. Frei gewählte Beträge sind ab 2 €
möglich. Pro Zahlung werden 0,50 € einbehalten, der Rest geht an den Zusteller. Der Kunde
zahlt exakt den gewählten Betrag, es kommt nichts obendrauf.

**Grund:** Mikrozahlungen sind durch fixe Payment-Gebühren dominiert; ein reiner
Prozentsatz wäre bei Kleinbeträgen nicht kostendeckend. Der frühere 1-€-Button hätte
bedeutet, dass die Plattform die Hälfte einbehält – nicht vertretbar für eine Marke, deren
Kern Wertschätzung ist.

**Vorteil:** Der schlechteste Fall für den Zusteller ist jetzt 75 % (bei 2 €) statt 50 %.
Für den Kunden bleibt es maximal verständlich. Deckungsbeitrag ab dem ersten Cent positiv
(0,17–0,22 € netto je Transaktion).

**Risiko:** 2 € als Einstieg ist eine höhere Hürde als 1 €. Es ist möglich, dass dadurch
weniger Menschen überhaupt zahlen. Das ist der Preis für ein Modell, das man öffentlich
verteidigen kann.

**Status:** Umgesetzt. **Messen:** Betragsverteilung und Tip-Conversion im Feldtest.

---

## 2. Keine Verifizierungspflicht

**Entscheidung:** Wer sich registriert, hat sofort einen funktionierenden Danke-Code und
kann Danke und Trinkgeld empfangen. Die Angabe des Zustelldienstes ist optional und wird
nicht geprüft. Identitätsprüfung passiert nur beim Zahlungsdienstleister, wenn ein
Auszahlungskonto eingerichtet wird.

**Grund:** Eine vorgelagerte Arbeitgeberprüfung hätte im Feldtest jeden Zusteller
tagelang blockiert – und ein Code, der nichts kann, bricht das Onboarding sofort.

**Vorteil:** Ein Zusteller kann in unter zwei Minuten starten und den Code am selben Tag
tragen. Das ist die Voraussetzung dafür, überhaupt 20–30 Testfahrer zu gewinnen.

**Risiko:** Jemand kann sich als Zusteller ausgeben, ohne einer zu sein. Die Bremse ist
die Auszahlung: Ohne KYC beim Zahlungsdienstleister kommt kein Geld an, und der
Adminbereich kann Konten sperren und Codes neu vergeben. Auf der Kundenseite steht bei
ungeprüften Angaben ausdrücklich „eigene Angabe“.

**Status:** Umgesetzt. **Beobachten:** Missbrauchsfälle im Feldtest. Wenn sie auftreten,
zuerst die Auszahlungsschwelle verschärfen, nicht die Registrierung.

---

## 3. Vertrauensabzeichen statt Verifizierungshürde

**Entscheidung:** Die Prüfung der Zustellertätigkeit bleibt erhalten, aber freiwillig.
Wer sie besteht, bekommt auf der Kundenseite „✓ Verifizierter Zusteller“.

**Grund:** Vertrauen beim Kunden ist wertvoll – als Angebot, nicht als Bedingung.

**Vorteil:** Motivierte Zusteller können sich abheben, ohne dass alle anderen ausgesperrt
werden.

**Risiko:** Wenn kaum jemand das Abzeichen anfragt, ist es totes Gewicht im Produkt.

**Status:** Umgesetzt. **Messen:** Wie viele Zusteller fragen es freiwillig an?

---

## 4. Eigene Authentifizierung statt Supabase Auth

**Entscheidung:** Session als signiertes HttpOnly-Cookie (JWT), Passwörter als
scrypt-Hash, Passwort-Reset über gehashte Einmal-Token im Anwendungscode.

**Grund:** Die App soll ohne jede externe Konfiguration lauffähig sein. Supabase Auth
hätte den Testmodus unmöglich gemacht und die Datenbank fest verdrahtet.

**Vorteil:** Kein Setup nötig, Datenbank bleibt austauschbar. Sessions hängen an einer
Token-Version – ein Passwort-Reset meldet alle anderen Geräte sofort ab.

**Risiko:** Kein Magic Link, keine Zwei-Faktor-Authentifizierung, kein OAuth. Der
Passwort-Reset braucht einen Mailversand; ohne `RESEND_API_KEY` wird nichts verschickt.

**Status:** Umgesetzt. **Später:** Magic Link, sobald mehr als ~50 Zusteller aktiv sind.

---

## 5. Testspeicher als Standard

**Entscheidung:** Standardmäßig läuft die App gegen `data/db.json`. Supabase wird über
eine Umgebungsvariable aktiviert.

**Grund:** `npm run dev` muss nach `npm install` sofort funktionieren – für Demos vor
Zustellern und möglichen Partnern.

**Vorteil:** Keine Infrastruktur nötig, um das Produkt zu zeigen.

**Risiko:** Auf Vercel ist das Dateisystem flüchtig. Wer versehentlich im Testmodus
deployt, verliert Daten bei jedem Neustart. Ein Banner weist sichtbar darauf hin, aber der
Fehler bleibt möglich.

**Status:** Umgesetzt. **Vor dem Feldtest zwingend:** `LIEFERDANK_DB=supabase`.

---

## 6. Zahlungsbestätigung ausschließlich per Webhook

**Entscheidung:** Eine Zahlung gilt nur dann als erfolgreich, wenn der signierte
Provider-Webhook das bestätigt. Die Rückkehr-URL des Kunden ändert nichts.

**Grund:** Die Rückkehr-URL ist vom Kunden manipulierbar. Wer sie kennt, könnte sich sonst
beliebig Trinkgeld gutschreiben.

**Vorteil:** Kein Weg, ohne echte Zahlung Guthaben zu erzeugen.

**Risiko:** Zwischen Zahlung und Webhook liegen Sekunden. Die Erfolgsseite zeigt in diesem
Fall „Zahlung wird bestätigt“ statt des Betrags.

**Status:** Umgesetzt.

---

## 7. Guthaben sammeln statt Sofortauszahlung

**Entscheidung:** Trinkgeld landet als Guthaben; die Auszahlung erfolgt gebündelt.

**Grund:** Auszahlungsgebühren pro Vorgang würden Kleinbeträge auffressen.

**Vorteil:** Wirtschaftlich tragfähig, für den Zusteller nachvollziehbar dargestellt.

**Risiko:** Der Zusteller wartet auf sein Geld. Im MVP löst ein Mensch die Auszahlung im
Adminbereich aus – das skaliert nicht über ~30 Zusteller hinaus.

**Status:** Umgesetzt. **Später:** automatischer wöchentlicher Auszahlungslauf.

---

## 8. Keine fremden Logos, nur Text

**Entscheidung:** Zustelldienste erscheinen ausschließlich als Text („unterwegs für DHL“).
Ungeprüfte Angaben werden als „eigene Angabe“ markiert.

**Grund:** Ohne Kooperation gibt es keine Nutzungsrechte an fremden Marken.

**Vorteil:** Kein markenrechtliches Risiko, trotzdem Vertrauensgewinn beim Kunden.

**Risiko:** Weniger visuelle Wiedererkennung als mit Logo.

**Status:** Umgesetzt. Technisch vorbereitet (`logoAllowed` je Anbieter), aktiviert wird es
erst mit Kooperation.

---

## 9. Schrift selbst gehostet

**Entscheidung:** Plus Jakarta Sans liegt als woff2 im Projekt, statt über Google Fonts
geladen zu werden.

**Grund:** Bei einem Google-Fonts-Einbindung geht die IP-Adresse jedes Besuchers an
Google. Für ein deutsches Produkt ist das ein bekanntes DSGVO-Risiko. Zusätzlich hing der
Produktionsbuild an der Erreichbarkeit eines fremden Dienstes.

**Vorteil:** Kein Drittanbieter-Request im Browser, kein Cookie-Banner-Thema, schnellerer
und verlässlicherer Build.

**Risiko:** Schrift-Updates müssen manuell nachgezogen werden. Zwei zusätzliche Dateien
(49 KB gesamt) im Repository.

**Status:** Umgesetzt.

---

## 10. Basis-URL automatisch aus dem LAN

**Entscheidung:** Ist `NEXT_PUBLIC_BASE_URL` nicht gesetzt, verwendet die App in der
Entwicklung die LAN-Adresse des Rechners statt `localhost`.

**Grund:** Ein QR-Code mit `localhost` ist von einem Handy aus wertlos – genau der Test,
der am wichtigsten ist.

**Vorteil:** Der QR-Code lässt sich ohne Tunnel und ohne Deployment mit einem echten
Telefon testen.

**Risiko:** Zeigt der Rechner mehrere Netzwerkschnittstellen, wird die erste genommen und
das kann die falsche sein. Deshalb steht die verwendete Adresse sichtbar im Dashboard, und
bei einer lokalen Adresse warnt ein roter Hinweis vor dem Druck.

**Status:** Umgesetzt.

---

## 11. Scans werden ungefiltert gezählt

**Entscheidung:** Jeder Aufruf der Kundenseite zählt als Scan – außer der Eigenvorschau
des Zustellers (`?vorschau=1`).

**Grund:** Die Scan-to-Payment-Conversion ist die wichtigste Kennzahl. Sie braucht einen
Nenner, bevor sie perfekt sein muss.

**Vorteil:** Sofort messbar, kein Cookie und keine Einwilligung nötig.

**Risiko:** Reloads, Bots und Link-Vorschauen blähen die Zahl auf. Die Conversion wird
dadurch **zu niedrig** ausgewiesen – im Zweifel also pessimistisch.

**Status:** Umgesetzt. **Später:** Deduplizierung pro Sitzung.

---

## 12. Rate Limiting im Arbeitsspeicher

**Entscheidung:** Limits liegen in einer Map im Prozessspeicher.

**Grund:** Kein zusätzlicher Dienst für den MVP.

**Vorteil:** Null Konfiguration, wirkt sofort gegen einfache Missbrauchsversuche.

**Risiko:** Bei mehreren Serverinstanzen (Vercel skaliert automatisch) gilt das Limit pro
Instanz, nicht global. Der Schutz ist schwächer als er aussieht.

**Status:** Umgesetzt. **Später:** Upstash/Redis, sobald echtes Geld fließt.

---

## 13. E-Mails nur für den Passwort-Reset

**Entscheidung:** Die einzige verschickte E-Mail ist der Link zum Zurücksetzen des
Passworts. Ohne `RESEND_API_KEY` wird nichts versendet, der Link erscheint stattdessen im
Browser und im Serverlog.

**Grund:** Ohne Passwort-Reset ist die Anmeldung nicht produktionsreif. Weitere
Benachrichtigungen sind für den Kernprozess nicht nötig.

**Vorteil:** Genau ein externer Dienst, und der ist optional.

**Risiko:** Ein Zusteller erfährt nicht per Mail, dass sein Abzeichen entschieden wurde
oder eine Auszahlung erfolgt ist – er muss ins Dashboard schauen. Im Feldtest mit 20–30
Personen lösbar, danach nicht mehr.

**Status:** Umgesetzt. **Direkt danach:** Abzeichen-Entscheidung und Auszahlung per Mail.

---

## 14. Zielgruppe erweitert: alle, die an die Haustür liefern

**Entscheidung:** Neben Paketzustellern sprechen Texte, Lieferdienst-Auswahl und Karten
ausdrücklich Essenslieferanten, Kuriere und Fahrer an.

**Grund:** Vorgabe aus dem finalen Produktbriefing.

**Vorteil:** Größerer Markt, gleiche Mechanik.

**Risiko:** Der Feldtest verliert an Schärfe. Wenn Paket- und Essensfahrer gemischt getestet
werden, sind die Kennzahlen schwerer zu deuten. **Empfehlung:** im Admin nach Lieferdienst
filtern und Kennzahlen getrennt auswerten.

**Status:** Umgesetzt.

---

## 15. Stripe Checkout statt eingebetteter Wallet-Buttons

**Entscheidung:** Nach der Betragswahl geht es zu Stripe Checkout. Dort erscheinen Apple
Pay, Google Pay, PayPal und Karte.

**Grund:** Checkout funktioniert ohne Domain-Verifizierung für Apple Pay, unterstützt alle
Zahlarten über eine Dashboard-Einstellung und hält Kartendaten vollständig von Lieferdank
fern. Es ist sofort nach dem Eintragen der Schlüssel einsatzbereit.

**Vorteil:** Kein Risiko bei der Integration, keine eigene PCI-Fläche.

**Risiko:** Ein Seitenwechsel mehr als nötig. Die schnellste Variante – Apple-Pay-Button
direkt auf der Danke-Seite (Stripe Express Checkout Element) – spart einen Schritt, braucht
aber Domain-Registrierung und Stripe.js auf der Seite.

**Status:** Umgesetzt. **Nächster Schritt**, sobald echte Zahlungen laufen: Express Checkout
Element testen und Conversion vergleichen.

---

## 16. Kundenkonten optional, nie Voraussetzung

**Entscheidung:** Kunden können ein Konto anlegen, um Lieferanten zu speichern. Das Angebot
erscheint erst nach einem Danke oder einer Zahlung, dezent, als Klick auf „speichern“.

**Grund:** Vorbereitung der späteren Kunden-App, ohne den Kernablauf zu belasten.

**Vorteil:** Wiederkehrende Kunden, Grundlage für „Meine Lieferanten“ in der App.

**Risiko:** Ein weiteres Konto-System, das gepflegt werden will. Die Zahlung hängt davon nie ab.

**Status:** Umgesetzt.

---

## 17. Physische Karten zunächst kostenlos

**Entscheidung:** Bestellungen laufen komplett durch (Adresse, Status, Versandmail), kosten
im Testbetrieb aber nichts. `CARD_ORDERS_PAID=true` schaltet die Bezahlung über Stripe ein.

**Grund:** Im Feldtest sollen Lieferanten die Karte ausprobieren, nicht über den Preis
nachdenken. Die Preislogik (Standard, persönlich, Bundles) ist fertig.

**Risiko:** Karten verursachen Kosten, bevor sie Geld bringen. Die Admin-Übersicht zeigt
offene Bestellungen, damit das kontrollierbar bleibt.

**Status:** Umgesetzt.

---

## 18. Eigene REST-API mit Bearer-Tokens

**Entscheidung:** `/api/v1` nutzt ausschließlich Bearer-Tokens, keine Cookies.

**Grund:** Apps können keine HttpOnly-Cookies sinnvoll nutzen. Und wenn die API Cookies
ignoriert, kann eine fremde Webseite keine Aktionen im Namen eines eingeloggten Nutzers
auslösen (CSRF).

**Vorteil:** Web und App teilen die Services, die API ist von Anfang an testbar.

**Risiko:** Tokens gelten 30 Tage. Widerruf funktioniert über `token_version` (Passwort
ändern, Sperre).

**Status:** Umgesetzt.

---

## 19. Projekt vom iCloud-Sync ausgenommen

**Entscheidung:** Der Projektordner auf dem Schreibtisch trägt das Attribut
`com.apple.fileprovider.ignore#P`.

**Grund:** iCloud blockierte Lesezugriffe auf frisch geschriebene Dateien, bis sie
hochgeladen waren. Builds und Typprüfung hingen dadurch minutenlang oder ganz.

**Vorteil:** Build in 19 Sekunden statt mehreren Minuten, keine „Stale NFS file handle“-Fehler.

**Risiko:** Der Ordner ist nicht mehr in iCloud gesichert. Die Sicherung läuft über GitHub –
regelmäßig pushen.

**Status:** Umgesetzt.
