import { api, apiError } from "@/server/api/handler";
import { isUuid } from "@/lib/id";
import { removeMessage } from "@/server/services/thanks";
export const DELETE = api<{ id: string }>({ auth: "driver", rateLimit: { key: "app-message-remove", limit: 30, windowMs: 600000 } }, async ({ session, params }) => {
  if (!isUuid(params.id)) return apiError(404, "not_found", "Nachricht nicht gefunden.");
  await removeMessage(session!.driver!.id, params.id); return { ok: true };
});
