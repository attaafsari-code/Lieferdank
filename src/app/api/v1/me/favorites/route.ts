import { z } from "zod";
import { api, readJson } from "@/server/api/handler";
import { addFavoriteByCode, listFavorites } from "@/server/services/favorites";

export const dynamic = "force-dynamic";

export const GET = api({ auth: "customer" }, async ({ session }) => {
  return { favorites: await listFavorites(session!.user.id) };
});

const body = z.object({ code: z.string().min(3).max(20) });

export const POST = api({ auth: "customer", rateLimit: { key: "api-favorite", limit: 30, windowMs: 60_000 } }, async ({ request, session }) => {
  const favorite = await addFavoriteByCode(session!.user.id, body.parse(await readJson(request)).code);
  return { favoriteId: favorite.id };
});
