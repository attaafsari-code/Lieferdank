/**
 * Regeln für die Basis-URL der QR-Codes – als reine Funktion, damit sie
 * testbar ist und nicht vom tatsächlichen Prozess-Environment abhängt.
 *
 * Harte Regel: In Produktion landet niemals localhost oder eine private
 * Netzwerkadresse in einem QR-Code.
 */

export const PRODUCTION_URL = "https://lieferdank.de";

export type BaseUrlEnv = {
  NODE_ENV?: string;
  NEXT_PUBLIC_BASE_URL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
  PORT?: string;
};

export type BaseUrlKind = "public" | "lan" | "localhost";

const PRIVATE_RANGES = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./];

function clean(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function classifyUrl(url: string): BaseUrlKind {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return "localhost";
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1") return "localhost";
  if (PRIVATE_RANGES.some((range) => range.test(host))) return "lan";
  return "public";
}

/** Eine Adresse, die in Produktion in einen QR-Code darf. */
function isProductionSafe(url: string): boolean {
  try {
    return new URL(url).protocol === "https:" && classifyUrl(url) === "public";
  } catch {
    return false;
  }
}

export type ResolvedBaseUrl = { url: string; source: string; warning: string | null };

/**
 * Reihenfolge:
 *  1. NEXT_PUBLIC_BASE_URL – in Produktion nur, wenn https und öffentlich
 *  2. Vercel Production → lieferdank.de
 *  3. Vercel Preview → Preview-Adresse (zum Testen gewollt)
 *  4. Sonstige Produktion → lieferdank.de
 *  5. Entwicklung → LAN-Adresse (Handy im WLAN kann scannen) oder localhost
 */
export function resolveBaseUrl(env: BaseUrlEnv, lanAddress: string | null): ResolvedBaseUrl {
  const production = env.NODE_ENV === "production";
  const explicit = env.NEXT_PUBLIC_BASE_URL ? clean(env.NEXT_PUBLIC_BASE_URL) : "";

  // Die echte Vercel-Produktivumgebung darf auch bei einer versehentlich
  // übernommenen Preview-URL keine falschen QR-Karten erzeugen.
  if (env.VERCEL_ENV === "production") {
    return {
      url: PRODUCTION_URL,
      source: "Vercel Production",
      warning: explicit && explicit !== PRODUCTION_URL
        ? `NEXT_PUBLIC_BASE_URL (${explicit}) wird in Produktion ignoriert – verwende ${PRODUCTION_URL}.`
        : null,
    };
  }

  if (explicit) {
    if (!production || isProductionSafe(explicit)) {
      return { url: explicit, source: "NEXT_PUBLIC_BASE_URL", warning: null };
    }
    return {
      url: PRODUCTION_URL,
      source: "Fallback",
      warning: `NEXT_PUBLIC_BASE_URL (${explicit}) ist in Produktion nicht erlaubt – verwende ${PRODUCTION_URL}.`,
    };
  }

  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    return { url: `https://${env.VERCEL_URL}`, source: "Vercel Preview", warning: null };
  }
  if (production) return { url: PRODUCTION_URL, source: "Produktion", warning: null };

  const port = env.PORT ?? "3000";
  if (lanAddress) return { url: `http://${lanAddress}:${port}`, source: "LAN", warning: null };
  return { url: `http://localhost:${port}`, source: "localhost", warning: null };
}
