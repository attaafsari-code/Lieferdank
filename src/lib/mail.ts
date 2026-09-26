import "server-only";

/**
 * Minimaler E-Mail-Versand.
 *
 * Ohne RESEND_API_KEY wird nichts verschickt: Die Nachricht landet im
 * Serverlog und der Aufrufer bekommt den Link zurück, damit der Ablauf
 * lokal komplett testbar bleibt.
 */

export type MailResult = { delivered: boolean; previewUrl?: string };

type Mail = { to: string; subject: string; text: string; previewUrl?: string };

const FROM = process.env.MAIL_FROM ?? "Lieferdank <noreply@lieferdank.de>";

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail({ to, subject, text, previewUrl }: Mail): Promise<MailResult> {
  if (!mailConfigured()) {
    console.info(
      `[mail] Kein RESEND_API_KEY gesetzt – E-Mail an ${to} nicht versendet.\n` +
        `        Betreff: ${subject}\n${text}`,
    );
    return { delivered: false, previewUrl };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, text }),
    });

    if (!response.ok) {
      console.error(`[mail] Versand fehlgeschlagen (${response.status}): ${await response.text()}`);
      return { delivered: false };
    }
    return { delivered: true };
  } catch (error) {
    console.error("[mail] Versand fehlgeschlagen:", error);
    return { delivered: false };
  }
}
