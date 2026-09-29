import "server-only";
import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import type { SystemEvent } from "@/lib/db/types";

/**
 * Technische Ereignisse für den Adminbereich („Fehlermeldungen“).
 * Schreibt zusätzlich ins Serverlog. Darf selbst niemals werfen.
 */
export async function logEvent(
  level: SystemEvent["level"],
  source: string,
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  const line = `[${source}] ${message}`;
  if (level === "error") console.error(line, context ?? "");
  else if (level === "warning") console.warn(line, context ?? "");

  try {
    await getDb().systemEvents.insert({
      id: newId(),
      level,
      source,
      message: message.slice(0, 500),
      context: context ?? null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[events] Ereignis konnte nicht gespeichert werden:", error instanceof Error ? error.name : "unknown");
  }
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  // Provider and database error messages may contain request bodies, emails,
  // account identifiers or even credentials. Keep only safe diagnostic codes.
  const coded = error as Error & { code?: unknown; type?: unknown; requestId?: unknown };
  const safe = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_.-]{1,80}$/.test(value) ? value : null;
  return [safe(coded.type) ?? safe(error.name) ?? "Error", safe(coded.code), safe(coded.requestId)]
    .filter(Boolean).join(":");
}
