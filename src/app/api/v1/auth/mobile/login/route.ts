import { api, readJson } from "@/server/api/handler";
import { mobileLogin } from "@/server/services/mobile";
export const POST = api({ rateLimit: { key: "mobile-login", limit: 10, windowMs: 600000 } }, async ({ request }) => mobileLogin(await readJson(request)));
