import { api } from "@/server/api/handler";
import { earnings } from "@/server/services/mobile";
export const GET = api({ auth: "driver" }, async ({ session, request }) => earnings(session!.driver!.id, new URL(request.url).searchParams));
