import { api, readJson } from "@/server/api/handler";
import { authenticate, loginSchema, parseInput } from "@/server/services/auth";
import { signSessionToken } from "@/server/session";

/**
 * Anmeldung für die App. Liefert ein Bearer-Token (30 Tage gültig).
 * Das Token gehört in den sicheren Speicher des Geräts (Keychain / Keystore).
 */
export const POST = api({ rateLimit: { key: "api-login", limit: 10, windowMs: 10 * 60_000 } }, async ({ request }) => {
  const user = await authenticate(parseInput(loginSchema, await readJson(request)));
  return {
    token: await signSessionToken(user),
    user: { id: user.id, role: user.role, firstName: user.firstName, email: user.email },
  };
});
