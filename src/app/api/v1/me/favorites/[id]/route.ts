import { z } from "zod";
import { api, readJson } from "@/server/api/handler";
import { removeFavorite, renameFavorite } from "@/server/services/favorites";

const body = z.object({ nickname: z.string().max(40) });

export const PATCH = api<{ id: string }>({ auth: "customer" }, async ({ request, params, session }) => {
  await renameFavorite(session!.user.id, params.id, body.parse(await readJson(request)).nickname);
  return { ok: true };
});

export const DELETE = api<{ id: string }>({ auth: "customer" }, async ({ params, session }) => {
  await removeFavorite(session!.user.id, params.id);
  return { ok: true };
});
