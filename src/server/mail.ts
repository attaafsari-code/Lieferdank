import "server-only";
import { logEvent } from "./events";

/**
 * E-Mail-Versand über Resend (HTTP-API, kein SDK nötig).
 *
 * Ohne RESEND_API_KEY wird nichts verschickt. Inhalte und Reset-Links werden
 * niemals protokolliert.
 * Mailversand darf nie einen Nutzerablauf abbrechen – Fehler werden protokolliert.
 */

export type MailContent = { subject: string; html: string; text: string };
export type MailResult = { delivered: boolean };

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(to: string, content: MailContent, tag: string): Promise<MailResult> {
  if (!mailConfigured()) {
    console.info(`[mail:${tag}] Kein RESEND_API_KEY – Nachricht nicht versendet.`);
    return { delivered: false };
  }

  try {
    const from = process.env.MAIL_FROM ?? "Lieferdank <noreply@lieferdank.de>";
    const replyTo = process.env.MAIL_REPLY_TO;
    if ([from, to, replyTo ?? ""].some((value) => /[\r\n]/.test(value))) {
      throw new Error("invalid_mail_header");
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: content.subject,
        html: content.html,
        text: content.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        tags: [{ name: "type", value: tag }],
      }),
    });

    if (!response.ok) {
      await logEvent("error", "mail", `Versand fehlgeschlagen (${response.status})`, { tag }).catch(() => undefined);
      return { delivered: false };
    }
    return { delivered: true };
  } catch (error) {
    await logEvent("error", "mail", "Versand fehlgeschlagen", {
      tag, errorType: error instanceof Error ? error.name : "unknown",
    }).catch(() => undefined);
    return { delivered: false };
  }
}
