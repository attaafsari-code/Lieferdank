import { api } from "@/server/api/handler";
import { sendFreeThankYou } from "@/server/services/thanks";

export const POST = api<{ code: string }>({ rateLimit: { key: "api-thanks", limit: 10, windowMs: 60_000 } }, async ({ params, session }) => {
  const result = await sendFreeThankYou(params.code, session?.customer ? session.user.id : null);
  return { thankYouId: result.thankYouId };
});
