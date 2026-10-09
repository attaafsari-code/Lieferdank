import { api, readJson } from "@/server/api/handler";
import { mobileRegister } from "@/server/services/mobile";
export const POST = api({ rateLimit: { key: "mobile-register", limit: 5, windowMs: 600000 } }, async ({ request }) => mobileRegister(await readJson(request)));
