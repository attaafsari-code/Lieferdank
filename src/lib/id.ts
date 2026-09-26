/**
 * IDs und Lieferdank-Codes. Nutzt Web Crypto – läuft in Node, im Browser und
 * in React Native (mit Polyfill) gleichermaßen.
 */

/** Ohne verwechselbare Zeichen (kein I, O, 0, 1): Der Code steht auf gedruckten Karten. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateLieferdankCode(length = 5): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `LD-${out}`;
}

export function newId(): string {
  return globalThis.crypto.randomUUID();
}

/** "ld 84k2p" → "LD-84K2P". */
export function normalizeCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = cleaned.startsWith("LD") ? cleaned.slice(2) : cleaned;
  return `LD-${body}`;
}

export function isValidCode(code: string): boolean {
  return /^LD-[23456789A-HJ-NP-Z]{5,6}$/.test(code) || /^LD-DEMO\d{2}$/.test(code);
}
