import { api } from "@/server/api/handler";
import { reportMessage } from "@/server/services/moderation";

/** Meldet eine Nachricht: sofort ausgeblendet, Prüfung durch den Betreiber. */
export const POST = api<{ id: string }>({ auth: "driver", rateLimit: { key: "app-report", limit: 30, windowMs: 600000 } }, async ({ session, params }) =>
  reportMessage(session!.driver!.id, params.id));
