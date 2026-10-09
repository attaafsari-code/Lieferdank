export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function validateApiBase(value: string, development = false): string {
  const u = new URL(value);
  if (u.username || u.password || u.search || u.hash || u.pathname !== "/") throw new Error("Ungültige API-Adresse");
  if (!development && (u.protocol !== "https:" || u.hostname !== "lieferdank.de" || u.port)) throw new Error("Release benötigt die LieferDank-Production-API");
  if (development && !["https:", "http:"].includes(u.protocol)) throw new Error("Ungültiges Protokoll");
  return u.origin;
}
export async function callApi<T>(base: string, path: string, token: string | null, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<T> {
  if (!path.startsWith("/api/v1/") || path.includes("..")) throw new Error("Ungültiger API-Pfad");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(`${base}${path}`, { ...init, signal: controller.signal, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers } });
    // HTML 404/503 from an undeployed route is a server problem, not lost connectivity.
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== "object") throw new ApiError(response.ok ? 502 : response.status,
      "Die App-Anbindung ist gerade nicht verfügbar. Bitte versuche es später erneut.");
    if (!response.ok) throw new ApiError(response.status, body.error?.message ?? "Die Anfrage konnte nicht abgeschlossen werden.");
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error("Keine Verbindung zu LieferDank. Prüfe deine Internetverbindung und versuche es erneut.");
  } finally { clearTimeout(timer); }
}
export type Screen = "dashboard" | "earnings" | "qr" | "thanks" | "profile" | "stripe" | "settings";
export function deepLink(value: string): { screen?: Screen; resetToken?: string; verificationToken?: string } | null {
  try {
    const u = new URL(value);
    if (u.protocol !== "lieferdank:" && !(u.protocol === "https:" && u.hostname === "lieferdank.de" && !u.port)) return null;
    if (u.username || u.password) return null;
    const path = u.protocol === "lieferdank:" ? `${u.hostname}${u.pathname}` : u.pathname.slice(1);
    if (["stripe-return", "app/stripe-return", "app/stripe-refresh"].includes(path)) return { screen: "stripe" };
    if (path === "passwort-neu") { const t = u.searchParams.get("token"); return t && /^[A-Za-z0-9_-]{43}$/.test(t) ? { resetToken: t } : null; }
    if (path === "email-bestaetigen") { const t = u.searchParams.get("token"); return t && t.length < 2048 ? { verificationToken: t } : null; }
    const screens: Screen[] = ["dashboard", "earnings", "qr", "thanks", "profile"];
    return screens.includes(path as Screen) ? { screen: path as Screen } : null;
  } catch { return null; }
}
export function trustedBrowserUrl(value: string): boolean {
  try { const u = new URL(value); return !u.username && !u.password && u.protocol === "https:" && !u.port && ["lieferdank.de", "connect.stripe.com", "dashboard.stripe.com"].includes(u.hostname); } catch { return false; }
}
/** Build the public destination from the authenticated driver's code, never a supplied redirect. */
export function driverThankUrl(code: string, base = "https://lieferdank.de", development = false): string {
  if (!/^LD-[A-Z0-9]{4,16}$/.test(code)) throw new Error("Ungültiger Danke-Code");
  return `${validateApiBase(base, development)}/danke/${code}`;
}
export const euro = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
