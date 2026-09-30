import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const TOKEN_PATTERN = /^([0-9a-f]{32})\.([0-9a-f]{64})$/;
export const VISITOR_COOKIE = "ld_visitor";
export const VISITOR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 90,
};

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET fehlt oder ist zu kurz.");
  return "lieferdank-dev-secret-nur-lokal-nicht-produktiv";
}

function signature(id: string): string {
  return createHmac("sha256", secret()).update(`visitor:${id}`).digest("hex");
}

export function readVisitorToken(token: string | undefined): string | null {
  const match = token?.match(TOKEN_PATTERN);
  if (!match) return null;
  const actual = Buffer.from(match[2], "hex");
  const expected = Buffer.from(signature(match[1]), "hex");
  return timingSafeEqual(actual, expected) ? match[1] : null;
}

export function visitorFromToken(token: string | undefined): { id: string; newToken: string | null } {
  const existing = readVisitorToken(token);
  if (existing) return { id: existing, newToken: null };
  const id = randomBytes(16).toString("hex");
  return { id, newToken: `${id}.${signature(id)}` };
}

export function visitorFromRequest(request: Request): { id: string; newToken: string | null } {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))?.slice(VISITOR_COOKIE.length + 1);
  return visitorFromToken(token);
}

/** Anonymer, signierter Browserbezeichner; nie in der Datenbank gespeichert. */
export async function visitorId(): Promise<string> {
  const jar = await cookies();
  const { id, newToken } = visitorFromToken(jar.get(VISITOR_COOKIE)?.value);
  if (newToken) jar.set(VISITOR_COOKIE, newToken, VISITOR_COOKIE_OPTIONS);
  return id;
}

/** Pro Fahrer und Tag anderer Hash: keine übergreifende Besuchshistorie. */
export function dailyVisitorHash(id: string, driverId: string, day: string): string {
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error("Ungültiger Besucherbezeichner.");
  return createHmac("sha256", secret()).update(`${driverId}:${day}:${id}`).digest("hex");
}
