import { randomBytes, randomUUID } from "node:crypto";

/**
 * Alphabet ohne verwechselbare Zeichen (kein I, O, 0, 1).
 * Der Code wird auf gedruckten Karten getragen und muss vorlesbar sein.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Erzeugt einen Lieferdank-Code wie "LD-84K2P" (§56). */
export function generateLieferdankCode(length = 5): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `LD-${out}`;
}

export function newId(): string {
  return randomUUID();
}

/** Normalisiert Nutzereingaben ("ld 84k2p" -> "LD-84K2P"). */
export function normalizeCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = cleaned.startsWith("LD") ? cleaned.slice(2) : cleaned;
  return `LD-${body}`;
}
