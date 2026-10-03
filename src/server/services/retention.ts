import "server-only";
import { getDb } from "@/lib/db";

/**
 * Löschfristen, die nicht an ein Konto gebunden sind (siehe Datenschutzhinweise, „Speicherdauer“).
 * Läuft täglich per Vercel Cron; mehrfaches Ausführen ist harmlos, weil nur Abgelaufenes gelöscht wird.
 */
export const RETENTION_DAYS = {
  /** Technische Fehler- und Ereignisprotokolle. */
  systemEvents: 365,
  /** Passwort-Links gelten 60 Minuten; danach bleiben sie nur kurz zur Missbrauchsaufklärung. */
  passwordResets: 30,
} as const;

const BATCH = 500;

export async function applyRetention(now = new Date()): Promise<{ systemEvents: number; passwordResets: number }> {
  const db = getDb();
  const cutoff = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60_000).toISOString();

  const eventsCutoff = cutoff(RETENTION_DAYS.systemEvents);
  const events = (await db.systemEvents.findMany({ orderBy: "createdAt", limit: BATCH })).filter((row) => row.createdAt < eventsCutoff);
  for (const row of events) await db.systemEvents.remove(row.id);

  const resetsCutoff = cutoff(RETENTION_DAYS.passwordResets);
  const resets = (await db.passwordResets.findMany({ orderBy: "createdAt", limit: BATCH })).filter((row) => row.createdAt < resetsCutoff);
  for (const row of resets) await db.passwordResets.remove(row.id);

  return { systemEvents: events.length, passwordResets: resets.length };
}
