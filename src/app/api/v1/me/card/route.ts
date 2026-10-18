import { api, readJson } from "@/server/api/handler";
import { cardContext, cardDesignSchema, saveCardDesign } from "@/server/services/cards";
import { readDriverPhoto } from "@/server/services/profile";
import type { Session } from "@/server/session";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function editor(session: Session) {
  const ctx = await cardContext(session.driver!, session.user);
  const photo = session.driver!.photoKey ? await readDriverPhoto(session.driver!) : null;
  return {
    design: { layout: ctx.design.layout, color: ctx.design.color ?? "blue", headline: ctx.design.headline,
      showPhoto: ctx.design.showPhoto, showProvider: ctx.design.showProvider, updatedAt: ctx.design.updatedAt },
    context: { rank: ctx.rank, publicName: ctx.publicName, initials: ctx.initials, code: ctx.code, qrSvg: ctx.qr,
      photoHref: photo ? `data:${photo.contentType};base64,${Buffer.from(photo.bytes).toString("base64")}` : null },
  };
}

export const GET = api({ auth: "driver" }, async ({ session }) => editor(session!));

const update = cardDesignSchema.extend({ updatedAt: z.string().datetime() });
export const PATCH = api({ auth: "driver", rateLimit: { key: "app-card", limit: 30, windowMs: 60_000 } }, async ({ request, session }) => {
  const input = update.parse(await readJson(request));
  await saveCardDesign(session!.driver!.id, input, input.updatedAt);
  return editor(session!);
});
