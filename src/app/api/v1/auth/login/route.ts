import { api, readJson } from "@/server/api/handler";
import { authenticate, loginSchema, parseInput } from "@/server/services/auth";
import { signSessionToken } from "@/server/session";
import { enforceRateLimitFor } from "@/server/rate-limit";

/**
 * Anmeldung für die App. Liefert ein Bearer-Token (30 Tage gültig).
 * Das Token gehört in den sicheren Speicher des Geräts (Keychain / Keystore).
 */
export const POST = api({ rateLimit: { key: "api-login", limit: 10, windowMs: 10 * 60_000 } }, async ({ request }) => {
  const credentials = parseInput(loginSchema, await readJson(request));
  enforceRateLimitFor(`login-email:${credentials.email}`, 20, 15 * 60_000);
  const user = await authenticate(credentials);
  return {
    token: await signSessionToken(user),
    user: { id: user.id, role: user.role, firstName: user.firstName, email: user.email },
  };
});
