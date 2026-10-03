import "server-only";
import { formatEuro } from "@/lib/format";
import { CARD_PRODUCT_LABELS } from "@/lib/pricing";
import type { CardOrder } from "@/lib/db/types";
import type { MailContent } from "./mail";
import { PRODUCTION_URL } from "@/lib/base-url";
import { OPERATOR, OPERATOR_ADDRESS_LINE, TIP_FEE_SUMMARY, TIPPING_SERVICE_NAME, WITHDRAWAL_FORM_LINES, withdrawalInstructions } from "@/lib/legal-content";

/**
 * E-Mail-Vorlagen. Jede Mail hat eine HTML- und eine Textfassung.
 * Inline-Styles und Tabellen, weil Mailprogramme kein modernes CSS können.
 */

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Block = { kind: "p"; text: string } | { kind: "button"; label: string; href: string } | { kind: "note"; text: string };

function layout(preheader: string, heading: string, blocks: Block[]): { html: string; text: string } {
  const body = blocks
    .map((block) => {
      if (block.kind === "button") {
        return `<tr><td style="padding:8px 0 20px"><a href="${escapeHtml(block.href)}" style="display:inline-block;background:#1a5ce0;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">${escapeHtml(block.label)}</a></td></tr>`;
      }
      const style =
        block.kind === "note"
          ? "margin:0 0 14px;font-size:13px;line-height:1.55;color:#8798b3"
          : "margin:0 0 14px;font-size:16px;line-height:1.6;color:#0d1b2f";
      return `<tr><td><p style="${style}">${escapeHtml(block.text)}</p></td></tr>`;
    })
    .join("");

  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#f7f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<span style="display:none;opacity:0;height:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e7ecf4;border-radius:20px;padding:32px">
<tr><td style="padding-bottom:24px;font-size:22px;font-weight:800;letter-spacing:-0.5px"><span style="color:#0b2545">Liefer</span><span style="color:#ff4d4a">dank</span></td></tr>
<tr><td style="padding-bottom:16px;font-size:22px;font-weight:800;color:#0b2545">${escapeHtml(heading)}</td></tr>
${body}
</table>
<p style="margin:20px 0 8px;font-size:12px;color:#8798b3">Lieferdank · Dein Danke kommt an.</p>
<p style="margin:0;font-size:12px"><a href="${PRODUCTION_URL}/legal/impressum">Impressum</a> · <a href="${PRODUCTION_URL}/legal/datenschutz">Datenschutz</a> · <a href="${PRODUCTION_URL}/legal/agb">AGB</a></p>
</td></tr></table></body></html>`;

  const text = [
    heading,
    "",
    ...blocks.map((block) => (block.kind === "button" ? `${block.label}: ${block.href}` : block.text)),
    "",
    "Lieferdank · Dein Danke kommt an.",
    `Impressum: ${PRODUCTION_URL}/legal/impressum`,
    `Datenschutz: ${PRODUCTION_URL}/legal/datenschutz`,
    `AGB: ${PRODUCTION_URL}/legal/agb`,
  ].join("\n");

  return { html, text };
}

function mail(subject: string, preheader: string, heading: string, blocks: Block[]): MailContent {
  return { subject, ...layout(preheader, heading, blocks) };
}

export const emails = {
  welcomeDriver(firstName: string, code: string, dashboardUrl: string, verifyUrl: string): MailContent {
    return mail(
      "Willkommen bei Lieferdank – dein Danke-Code ist fertig",
      `Dein persönlicher Code: ${code}`,
      `Willkommen, ${firstName}!`,
      [
        { kind: "p", text: `Dein persönlicher Lieferdank-Code lautet ${code}. Er funktioniert ab sofort.` },
        { kind: "p", text: "Bitte bestätige noch deine E-Mail-Adresse. Erst danach kannst du dein Auszahlungskonto bei Stripe einrichten." },
        { kind: "button", label: "E-Mail-Adresse bestätigen", href: verifyUrl },
        { kind: "p", text: "Gestalte deine Karte, drucke sie aus oder zeig den QR-Code direkt am Handy." },
        { kind: "button", label: "Zum Dashboard", href: dashboardUrl },
        { kind: "note", text: "Bitte beachte die Regeln deines Arbeitgebers bzw. Auftraggebers." },
      ],
    );
  },

  welcomeCustomer(firstName: string, accountUrl: string, verifyUrl: string): MailContent {
    return mail(
      "Willkommen bei Lieferdank",
      "Deine Lieblingslieferanten an einem Ort",
      `Schön, dass du da bist${firstName ? `, ${firstName}` : ""}!`,
      [
        { kind: "p", text: "Du kannst jetzt Lieferanten speichern und ihnen jederzeit wieder Danke sagen." },
        { kind: "p", text: "Bitte bestätige noch kurz deine E-Mail-Adresse." },
        { kind: "button", label: "E-Mail-Adresse bestätigen", href: verifyUrl },
        { kind: "button", label: "Meine Lieferanten", href: accountUrl },
      ],
    );
  },

  verifyEmail(firstName: string, link: string, ttlDays: number): MailContent {
    return mail(
      "Bitte bestätige deine E-Mail-Adresse",
      "Ein Klick, dann ist deine Adresse bestätigt",
      "E-Mail-Adresse bestätigen",
      [
        { kind: "p", text: `Hallo ${firstName || "du"}, bitte bestätige, dass diese E-Mail-Adresse zu deinem Lieferdank-Konto gehört.` },
        { kind: "button", label: "E-Mail-Adresse bestätigen", href: link },
        {
          kind: "note",
          text: `Der Link gilt ${ttlDays} Tage. Wenn du kein Konto bei Lieferdank angelegt hast, ignoriere diese E-Mail.`,
        },
      ],
    );
  },

  passwordReset(firstName: string, link: string, ttlMinutes: number): MailContent {
    return mail(
      "Neues Passwort für Lieferdank",
      "Setze dein Passwort zurück",
      "Neues Passwort setzen",
      [
        { kind: "p", text: `Hallo ${firstName}, über den Button kannst du ein neues Passwort setzen.` },
        { kind: "button", label: "Passwort setzen", href: link },
        {
          kind: "note",
          text: `Der Link gilt ${ttlMinutes} Minuten. Wenn du das nicht angefordert hast, ignoriere diese E-Mail – dein Passwort bleibt unverändert.`,
        },
      ],
    );
  },

  tipReceived(firstName: string, driverCents: number, grossCents: number, dashboardUrl: string): MailContent {
    return mail(
      `Ein neues Trinkgeld für dich`,
      "Jemand hat dir Danke gesagt",
      "Jemand hat dir Danke gesagt ❤",
      [
        {
          kind: "p",
          text: `Hallo ${firstName}, ein Kunde hat dir ${formatEuro(grossCents)} Trinkgeld gegeben. Dein Anteil vor Stripe-Kosten beträgt ${formatEuro(driverCents)}. Den tatsächlichen Auszahlungsbetrag zeigt Stripe.`,
        },
        { kind: "button", label: "Nachricht ansehen", href: dashboardUrl },
        { kind: "note", text: "Du kannst diese Benachrichtigung im Profil abschalten." },
      ],
    );
  },

  payoutSent(firstName: string, amountCents: number, earningsUrl: string): MailContent {
    return mail(
      `${formatEuro(amountCents)} für die Auszahlung erfasst`,
      "Deine Trinkgelder wurden bei Stripe erfasst",
      "Deine Trinkgelder sind bei Stripe",
      [
        {
          kind: "p",
          text: `Hallo ${firstName}, ${formatEuro(amountCents)} wurden für dein Stripe-Auszahlungskonto erfasst. Wann das Geld auf deinem Bankkonto ankommt, zeigt dir Stripe.`,
        },
        { kind: "button", label: "Einnahmen ansehen", href: earningsUrl },
      ],
    );
  },

  cardOrderReceived(firstName: string, order: CardOrder, ordersUrl: string): MailContent {
    const price = order.totalCents === 0 ? "kostenlos" : formatEuro(order.totalCents);
    return mail(
      "Deine Kartenbestellung ist eingegangen",
      `${order.quantity}× ${CARD_PRODUCT_LABELS[order.product]}`,
      "Bestellung eingegangen",
      [
        {
          kind: "p",
          text: `Hallo ${firstName}, wir haben deine Bestellung erhalten: ${order.quantity}× ${CARD_PRODUCT_LABELS[order.product]} (${price}).`,
        },
        {
          kind: "p",
          text: `Lieferadresse: ${order.shippingName}, ${order.shippingStreet}, ${order.shippingPostalCode} ${order.shippingCity}`,
        },
        { kind: "button", label: "Bestellung ansehen", href: ordersUrl },
      ],
    );
  },

  cardOrderShipped(firstName: string, order: CardOrder, ordersUrl: string): MailContent {
    const tracking =
      order.trackingNumber && order.carrier
        ? `Sendungsnummer (${order.carrier}): ${order.trackingNumber}`
        : order.trackingNumber
          ? `Sendungsnummer: ${order.trackingNumber}`
          : "Die Karten sollten in wenigen Tagen bei dir sein.";
    return mail(
      "Deine Lieferdank-Karten sind unterwegs",
      "Versandbestätigung",
      "Deine Karten sind unterwegs",
      [
        { kind: "p", text: `Hallo ${firstName}, deine ${order.quantity} Lieferdank-Karte(n) wurden verschickt.` },
        { kind: "p", text: tracking },
        { kind: "button", label: "Bestellung ansehen", href: ordersUrl },
      ],
    );
  },

  /**
   * Vertragsbestätigung für die Trinkgeld-Funktion auf dauerhaftem Datenträger (§ 312f Abs. 2 BGB)
   * mit den Angaben nach Art. 246a EGBGB, Widerrufsbelehrung und Muster-Widerrufsformular.
   */
  tippingContract(firstName: string, concludedAt: string, termsUrl: string, withdrawUrl: string, cancelUrl: string): MailContent {
    const blocks: Block[] = [
      { kind: "p", text: `Hallo ${firstName}, hiermit bestätigen wir deinen Vertrag über die Lieferdank-${TIPPING_SERVICE_NAME}, geschlossen am ${concludedAt}.` },
      { kind: "p", text: `Anbieter: ${OPERATOR_ADDRESS_LINE}, E-Mail: ${OPERATOR.email}. Kontakt und Beschwerden: ${PRODUCTION_URL}/kontakt` },
      { kind: "p", text: "Leistung: Kunden können dir über deinen Danke-Code freiwilliges Trinkgeld geben. Stripe wickelt die Zahlung direkt auf deinem eigenen Stripe-Konto ab und zahlt das Guthaben nach deinem Auszahlungsplan aus. Lieferdank nimmt kein Kundengeld entgegen." },
      { kind: "p", text: `Preis: Je erhaltenem Trinkgeld behält Lieferdank eine Gebühr ein (${TIP_FEE_SUMMARY}). Weitere Kosten berechnet Lieferdank nicht. Stripe berechnet seine Zahlungs- und gegebenenfalls Auszahlungskosten nach den Bedingungen von Stripe separat auf deinem Stripe-Konto. Wird ein Trinkgeld erstattet, gibt Lieferdank die Gebühr vollständig bzw. anteilig zurück.` },
      { kind: "p", text: `Laufzeit: unbefristet, ohne Mindestlaufzeit. Du kannst jederzeit ohne Frist kündigen – über „Verträge hier kündigen“ (${cancelUrl}) oder indem du dein Konto im Profil löschst.` },
      { kind: "p", text: "Für die Trinkgeld-Funktion als digitale Dienstleistung gilt das gesetzliche Gewährleistungsrecht." },
      { kind: "p", text: "Du hast verlangt, dass wir mit der Leistung vor Ablauf der Widerrufsfrist beginnen. Bei einem Widerruf schuldest du für die bis dahin erbrachten Leistungen einen anteiligen Betrag." },
      { kind: "button", label: "Allgemeine Geschäftsbedingungen", href: termsUrl },
    ];
    for (const section of withdrawalInstructions(withdrawUrl)) {
      blocks.push({ kind: "p", text: section.heading });
      for (const paragraph of section.paragraphs) blocks.push({ kind: "note", text: paragraph });
    }
    blocks.push({ kind: "p", text: "Muster-Widerrufsformular" });
    for (const line of WITHDRAWAL_FORM_LINES) blocks.push({ kind: "note", text: line });
    return mail(`Vertragsbestätigung: Lieferdank-${TIPPING_SERVICE_NAME}`, "Deine Vertragsbestätigung mit Widerrufsbelehrung", "Vertragsbestätigung", blocks);
  },

  /** Information an den Zusteller, wenn Lieferdank eine Erstattung zu seinen Lasten ausgelöst hat. */
  refundNotice(firstName: string, refundedCents: number, grossCents: number, reason: string, earningsUrl: string): MailContent {
    return mail(
      "Ein Trinkgeld wurde erstattet",
      `${formatEuro(refundedCents)} an den Kunden erstattet`,
      "Erstattung eines Trinkgelds",
      [
        { kind: "p", text: `Hallo ${firstName}, Lieferdank hat von einem Trinkgeld über ${formatEuro(grossCents)} insgesamt ${formatEuro(refundedCents)} über Stripe an den Kunden erstattet. Der Betrag wird deinem Stripe-Konto belastet; die Lieferdank-Gebühr geben wir dir vollständig bzw. anteilig zurück.` },
        { kind: "p", text: `Grund: ${reason}` },
        { kind: "p", text: `Fragen oder Einwände? Schreib uns an ${OPERATOR.email}.` },
        { kind: "button", label: "Einnahmen ansehen", href: earningsUrl },
      ],
    );
  },

  /** Eingangsbestätigung an die Person, die ein Formular abgeschickt hat (Kündigung, Widerruf, Meldung, Kontakt). */
  requestReceipt(subject: string, intro: string, lines: string[], receivedAt: string): MailContent {
    return mail(subject, intro, subject, [
      { kind: "p", text: intro },
      { kind: "p", text: `Eingegangen am ${receivedAt}.` },
      ...lines.map((text): Block => ({ kind: "note", text })),
      { kind: "note", text: `Lieferdank · ${OPERATOR_ADDRESS_LINE} · ${OPERATOR.email}` },
    ]);
  },

  /** Weiterleitung eines Formulars an das Lieferdank-Postfach. */
  requestToOperator(subject: string, lines: string[], receivedAt: string): MailContent {
    return mail(subject, subject, subject, [
      { kind: "p", text: `Eingegangen am ${receivedAt}.` },
      ...lines.map((text): Block => ({ kind: "p", text })),
    ]);
  },
};
