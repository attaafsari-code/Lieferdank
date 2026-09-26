import "server-only";
import { logEvent } from "./events";

/**
 * E-Mail-Versand über Resend (HTTP-API, kein SDK nötig).
 *
 * Ohne RESEND_API_KEY wird nichts verschickt: Die Nachricht landet im Serverlog.
 * Mailversand darf nie einen Nutzerablauf abbrechen – Fehler werden protokolliert.
 */

export type MailContent = { subject: string; html: string; text: string };
export type MailResult = { delivered: boolean };

const FROM = process.env.MAIL_FROM ?? "Lieferdank <noreply@lieferdank.de>";
const REPLY_TO = process.env.MAIL_REPLY_TO;

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(to: string, content: MailContent, tag: string): Promise<MailResult> {
  if (!mailConfigured()) {
    console.info(`[mail:${tag}] Kein RESEND_API_KEY – nicht versendet an ${to}: ${content.subject}\n${content.text}`);
    return { delivered: false };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: content.subject,
        html: content.html,
        text: content.text,
        ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
        tags: [{ name: "type", value: tag }],
      }),
    });

    if (!response.ok) {
      await logEvent("error", "mail", `Versand fehlgeschlagen (${response.status})`, {
        tag,
        body: (await response.text()).slice(0, 300),
      });
      return { delivered: false };
    }
    return { delivered: true };
  } catch (error) {
    await logEvent("error", "mail", "Versand fehlgeschlagen", { tag, error: String(error) });
    return { delivered: false };
  }
}
