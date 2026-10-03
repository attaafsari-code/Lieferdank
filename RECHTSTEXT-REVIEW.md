# Rechtstexte – offene Entscheidungen vor dem Release

Stand: 03.10.2026. AGB, Datenschutzhinweise und Impressum beschreiben den technisch
implementierten Ablauf (Code ist die Quelle). Die folgenden Punkte brauchen eine Entscheidung
des Betreibers bzw. eine Rechtsberatung. Sie sind bewusst **nicht** ausformuliert worden.
Im Code verweisen Kommentare `REVIEW (RECHTSTEXT-REVIEW.md, Nr. …)` auf diese Liste.

Solange die Punkte offen sind, bleiben die Hinweise „Entwurf – noch nicht rechtsverbindlich“
auf AGB und Datenschutzhinweisen stehen.

## AGB

1. **Haftung (§ 10)** – Platzhalter `[Haftungsregelung durch Rechtsberatung ergänzen.]`.
2. **Recht und Gerichtsstand (§ 12)** – Platzhalter `[Gerichtsstand …]`. Zu klären auch, wie
   die Rechtswahl gegenüber Verbrauchern formuliert werden darf.
3. **Erstattungen (§ 7)** – Technisch kann ein Admin eine Voll- oder Teilerstattung auslösen,
   die Stripe dem Konto des Zustellers belastet; Lieferdank gibt seine Gebühr vollständig
   bzw. anteilig zurück, auch bei Erstattungen, die der Zusteller selbst in Stripe auslöst.
   Offen: Ob, wann und mit welcher Information an den Zusteller Lieferdank eine Erstattung
   zu dessen Lasten auslösen darf, und welche Ansprüche Sender auf Erstattung haben.
4. **Einordnung der Zahlung** – Rolle von Lieferdank (technische Plattform, Gebühr als
   Application Fee), Vertragsverhältnis Sender ↔ Zusteller, Verbraucherinformationen und
   ein etwaiges Widerrufsrecht für freiwillige Trinkgelder.
5. **Mindestalter** – Die Registrierung prüft kein Alter.
6. **Änderungen der AGB (§ 11)** – „werden rechtzeitig angekündigt“: Form und Frist festlegen.
   Ein automatischer Rundmail-Versand an alle Konten ist nicht implementiert.
7. **Nachrichten** – Sender können optional eine Vorlage oder einen Freitext (bis 140 Zeichen)
   senden. Es gibt keine Moderation und im Admin keine Löschfunktion für Nachrichten.
   Offen: Nutzungsregeln für Inhalte und ein Meldeweg.

## Datenschutz

8. **Rollen** – Verantwortlichkeit von Lieferdank, Stripe (Stripe Connect, Standard-Konten,
   Direct Charges) und Zustellern; gegebenenfalls gemeinsame Verantwortlichkeit.
9. **Speicherdauer und Rechtsgrundlagen** – Konkrete Fristen für pseudonymisierte Datensätze
   gelöschter Konten (Danke, Nachrichten, Trinkgeldbuchungen, Stripe-Konto-ID), für Scans,
   Ereignisprotokolle und Server-Logs des Hosters; Rechtsgrundlage je Verarbeitung (Danke ohne
   Konto, Scans, Nachrichten, Trinkgeld-Benachrichtigungen, Verifizierungs-Abzeichen).
10. **Cookies** – Rechtsgrundlage für die technisch notwendigen Cookies `ld_session`,
    `ld_visitor` und `ld_message_grant` (§ 25 Abs. 2 TDDDG) formulieren.
11. **Auftragsverarbeitung und Drittlandtransfer** – AV-Verträge mit Vercel, Supabase, Resend und
    IONOS abschließen bzw. bestätigen; die Grundlagen der Drittlandübermittlung sind bisher nur
    als „nach eigenen Angaben der Anbieter“ beschrieben.

## Impressum und Betreiber

12. **Zweiter Kontaktweg** – Angegeben ist nur die E-Mail-Adresse (bewusst keine Telefonnummer).
    Klären, ob ein weiterer schneller Kontaktweg (z. B. Kontaktformular) erforderlich ist.
13. **Betreiberstatus** – Gewerbeanmeldung, steuerliche Angaben (z. B. USt-IdNr.) und deren
    Auswirkung auf Impressum und AGB, da Lieferdank Gebühren einnimmt.
14. **Verbraucherstreitbeilegung** – Die bestehende Erklärung bestätigen.
