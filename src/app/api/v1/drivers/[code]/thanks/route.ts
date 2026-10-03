import { api } from "@/server/api/handler";
import { sendFreeThankYou } from "@/server/services/thanks";
import { NextResponse } from "next/server";
import { VISITOR_COOKIE, VISITOR_COOKIE_OPTIONS, visitorFromRequest } from "@/server/visitor";
import { signMessageGrant, thankYouSubject } from "@/server/message-grant";

export const POST = api<{ code: string }>({ rateLimit: { key: "api-thanks", limit: 10, windowMs: 60_000 } }, async ({ request, params, session }) => {
  const visitor = visitorFromRequest(request);
  const result = await sendFreeThankYou(params.code, session?.customer ? session.user.id : null, visitor.id);
  // messageToken ist das Schreibrecht für die optionale Nachricht – nur der Absender bekommt es.
  const messageToken = await signMessageGrant([thankYouSubject(result.thankYouId)]);
  const response = NextResponse.json({ thankYouId: result.thankYouId, alreadySent: result.alreadySent, messageToken }, { headers: { "cache-control": "no-store" } });
  if (visitor.newToken) response.cookies.set(VISITOR_COOKIE, visitor.newToken, VISITOR_COOKIE_OPTIONS);
  return response;
});
