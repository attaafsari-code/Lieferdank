import { api } from "@/server/api/handler";
import { getDb } from "@/lib/db";
import { pageQuery, nextPage } from "@/server/services/mobile";
export const GET = api({ auth: "driver" }, async ({ session, request }) => {
  const { limit, before } = pageQuery(new URL(request.url).searchParams);
  const items = await getDb().thankYous.findMany({ where: { driverId: session!.driver!.id }, orderBy: "createdAt", desc: true, limit, before });
  return { items: items.map(({ id, tipId, presetId, message, createdAt }) => ({ id, tipId, presetId, message, createdAt })), nextCursor: nextPage(items, limit) };
});
