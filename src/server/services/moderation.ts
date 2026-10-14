import "server-only";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { REMOVED_MESSAGE_ID } from "@/lib/messages";
import { OPERATOR } from "@/lib/legal-content";
import { ServiceError, notFound } from "../errors";
import { emails } from "../emails";
import { sendMail } from "../mail";
import { logEvent } from "../events";

/**
 * Moderation of customer messages (App Review Guideline 1.2):
 * 1. filter obvious spam and abuse before a message is stored,
 * 2. drivers can report a message (hidden at once, reviewed by the operator),
 * 3. drivers can block the pseudonymous sender of a message,
 * 4. the operator resolves reports in the admin area.
 */

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(de|com|net|org|io|info|ru|cn|xyz|top|link)\b)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const PHONE = /(\+|00)?\d[\d\s/().-]{7,}\d/;
// Deliberately short: the most severe insults and slurs in German and English. Everything else goes through reporting.
const ABUSIVE = /\b(hurensohn|hure|fotze|wichser|missgeburt|schlampe|spast|spasti|nazi|kanake|neger|nigger|faggot|cunt|whore|retard|bastard|arschloch|fick\w*|fuck\w*|kill yourself|bring dich um)\b/i;

/** Rejects messages with links, contact data or severe insults. Returns the cleaned text. */
export function screenMessage(text: string): string {
  if (LINK.test(text) || EMAIL.test(text) || PHONE.test(text) || ABUSIVE.test(text.normalize("NFKC"))) {
    throw new ServiceError("message_rejected", "Diese Nachricht können wir so nicht zustellen. Bitte ohne Links, Kontaktdaten oder Beleidigungen.", 400, "message");
  }
  return text;
}

export async function isBlockedSender(driverId: string, key: string | null): Promise<boolean> {
  return Boolean(key && await getDb().blockedSenders.findOne({ driverId, senderKey: key }));
}

async function ownedMessage(driverId: string, thankYouId: string) {
  const thankYou = await getDb().thankYous.get(thankYouId);
  if (!thankYou || thankYou.driverId !== driverId) throw notFound("Nachricht nicht gefunden.");
  return thankYou;
}

/** Reports a message: hidden for the driver immediately, kept once for the operator's review. */
export async function reportMessage(driverId: string, thankYouId: string): Promise<{ reported: boolean }> {
  const db = getDb();
  const thankYou = await ownedMessage(driverId, thankYouId);
  if (!thankYou.message) {
    await db.thankYous.update(thankYou.id, { presetId: REMOVED_MESSAGE_ID, message: null });
    return { reported: false };
  }
  if (!await db.messageReports.findOne({ thankYouId: thankYou.id })) {
    try {
      await db.messageReports.insert({ id: newId(), thankYouId: thankYou.id, driverId, message: thankYou.message, status: "open", createdAt: new Date().toISOString(), resolvedAt: null });
    } catch (error) {
      if (!await db.messageReports.findOne({ thankYouId: thankYou.id })) throw error;
    }
    const sent = await sendMail(OPERATOR.email, emails.requestToOperator("Gemeldete Nachricht in der App", [
      "Ein Zusteller hat eine Nachricht gemeldet. Sie ist für ihn bereits ausgeblendet.",
      "Bitte im Adminbereich unter „System“ prüfen und erledigen.",
    ], new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })), "message_report");
    if (!sent.delivered) await logEvent("warning", "moderation", "Meldung gespeichert, Hinweis-Mail nicht versendet", { thankYouId: thankYou.id }).catch(() => undefined);
  }
  await db.thankYous.update(thankYou.id, { presetId: REMOVED_MESSAGE_ID, message: null });
  return { reported: true };
}

/** Blocks future messages from the sender of this message (pseudonymous, per driver). */
export async function blockSender(driverId: string, thankYouId: string): Promise<void> {
  const db = getDb();
  const thankYou = await ownedMessage(driverId, thankYouId);
  if (!thankYou.senderKey) {
    throw new ServiceError("sender_unknown", "Für diese ältere Nachricht ist kein Absender gespeichert. Du kannst sie entfernen oder melden.", 409);
  }
  if (!await isBlockedSender(driverId, thankYou.senderKey)) {
    try {
      await db.blockedSenders.insert({ id: newId(), driverId, senderKey: thankYou.senderKey, createdAt: new Date().toISOString() });
    } catch (error) {
      if (!await isBlockedSender(driverId, thankYou.senderKey)) throw error;
    }
  }
  await db.thankYous.update(thankYou.id, { presetId: REMOVED_MESSAGE_ID, message: null });
}

export async function openReports() {
  return getDb().messageReports.findMany({ where: { status: "open" }, orderBy: "createdAt", desc: true, limit: 100 });
}

/** The operator closes a report; the reported text is deleted with it (no longer needed). */
export async function resolveReport(reportId: string): Promise<void> {
  const db = getDb();
  const report = await db.messageReports.get(reportId);
  if (!report) throw notFound();
  await db.messageReports.update(report.id, { status: "resolved", resolvedAt: new Date().toISOString(), message: null });
}
