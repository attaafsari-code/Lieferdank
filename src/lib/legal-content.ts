/**
 * Rechtlich relevante Angaben, die an mehreren Stellen gleich lauten müssen: Impressum, AGB,
 * Widerrufsbelehrung, Vertragsbestätigung per E-Mail und Formulare.
 */

export const OPERATOR: {
  name: string; street: string; city: string; country: string; email: string;
  /**
   * Pflichtangabe für Verbraucherverträge im Fernabsatz (Art. 246a § 1 Abs. 1 Nr. 3 EGBGB) und
   * Teil des Widerrufsmusters. Noch nicht festgelegt – bis dahin bleibt der Entwurfshinweis auf den AGB.
   */
  phone: string | null;
} = {
  name: "Atta Afsari Gargari",
  street: "Dürkheimerstraße 2",
  city: "76187 Karlsruhe",
  country: "Deutschland",
  email: "info@lieferdank.de",
  phone: null,
};

export const OPERATOR_ADDRESS_LINE = `${OPERATOR.name}, ${OPERATOR.street}, ${OPERATOR.city}, ${OPERATOR.country}`;
const OPERATOR_CONTACT = `${OPERATOR.phone ? `Telefon: ${OPERATOR.phone}, ` : ""}E-Mail: ${OPERATOR.email}`;

/** Gebühren der Trinkgeld-Funktion je Trinkgeldbetrag (siehe splitTip in money.ts). */
export const TIP_FEE_SUMMARY = "0,50 € bei 2 €, 0,60 € bei 3 € und 1,00 € bei 5 € Trinkgeld";

/** Der kostenpflichtige Teil des Vertrags mit Zustellern – so heißt er überall gleich. */
export const TIPPING_SERVICE_NAME = "Trinkgeld-Funktion";

/**
 * Widerrufsbelehrung für die Trinkgeld-Funktion nach dem gesetzlichen Muster
 * (Anlage 1 zu Art. 246a § 1 Abs. 2 Satz 2 EGBGB), Gestaltungshinweise für Dienstleistungen,
 * Online-Widerrufsfunktion und Wertersatz. Absätze als Liste, damit Seite und E-Mail denselben Text zeigen.
 */
export function withdrawalInstructions(withdrawUrl: string): { heading: string; paragraphs: string[] }[] {
  return [
    {
      heading: "Widerrufsrecht",
      paragraphs: [
        "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.",
        "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.",
        `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${OPERATOR_ADDRESS_LINE}, ${OPERATOR_CONTACT}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.`,
        `Sie können Ihr Widerrufsrecht auch online unter ${withdrawUrl} ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.`,
        "Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.",
      ],
    },
    {
      heading: "Folgen des Widerrufs",
      paragraphs: [
        "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.",
        "Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.",
      ],
    },
  ];
}

/** Muster-Widerrufsformular nach Anlage 2 zu Art. 246a § 1 Abs. 2 Satz 1 Nr. 1 EGBGB. */
export const WITHDRAWAL_FORM_LINES = [
  "(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)",
  `– An ${OPERATOR_ADDRESS_LINE}, E-Mail: ${OPERATOR.email}:`,
  `– Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung: Lieferdank-${TIPPING_SERVICE_NAME}`,
  "– Bestellt am (*)",
  "– Name des/der Verbraucher(s)",
  "– Anschrift des/der Verbraucher(s)",
  "– Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)",
  "– Datum",
  "(*) Unzutreffendes streichen.",
];
