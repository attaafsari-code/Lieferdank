import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isServiceError } from "../errors";
import { errorMessage, logEvent } from "../events";
import { ipFromHeaders, rateLimit } from "../rate-limit";
import { getBearerSession, type Session } from "../session";

/**
 * Gemeinsamer Rahmen für /api/v1: Fehlerformat, Rate Limit, Authentifizierung.
 *
 * Fehler kommen immer als { error: { code, message, field? } } mit passendem
 * HTTP-Status zurück – damit kann eine App sauber reagieren.
 */

type Ctx<P> = { request: Request; params: P; session: Session | null };

type Options = {
  /** "driver" | "customer" | "any" – ohne Angabe ist der Endpunkt öffentlich. */
  auth?: "driver" | "customer" | "any";
  rateLimit?: { key: string; limit: number; windowMs: number };
};

export function apiError(status: number, code: string, message: string, field?: string) {
  return NextResponse.json({ error: { code, message, ...(field ? { field } : {}) } }, { status });
}

export function api<P = Record<string, string>>(
  options: Options,
  handler: (ctx: Ctx<P>) => Promise<unknown>,
) {
  return async (request: Request, context: { params: Promise<P> }) => {
    try {
      if (options.rateLimit) {
        const key = `${options.rateLimit.key}:${ipFromHeaders(request.headers)}`;
        if (!rateLimit(key, options.rateLimit.limit, options.rateLimit.windowMs)) {
          return apiError(429, "rate_limited", "Zu viele Anfragen. Bitte kurz warten.");
        }
      }

      const session = await getBearerSession(request);
      if (options.auth) {
        if (!session) return apiError(401, "unauthorized", "Bitte anmelden.");
        if (options.auth === "driver" && !session.driver) return apiError(403, "forbidden", "Nur für Lieferanten.");
        if (options.auth === "customer" && !session.customer) return apiError(403, "forbidden", "Nur für Kunden.");
      }

      const result = await handler({ request, params: await context.params, session });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true }, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      if (isServiceError(error)) return apiError(error.status, error.code, error.message, error.field);
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return apiError(400, "invalid_input", issue.message, String(issue.path[0] ?? ""));
      }
      if (error instanceof SyntaxError) return apiError(400, "invalid_json", "Ungültiges JSON.");
      await logEvent("error", "api", "Unerwarteter Fehler", { path: new URL(request.url).pathname, error: errorMessage(error) });
      return apiError(500, "internal", "Unerwarteter Fehler.");
    }
  };
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > 20_000) throw new SyntaxError("zu groß");
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}
