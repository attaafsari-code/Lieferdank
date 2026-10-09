import { api, apiError } from "@/server/api/handler";
import { readDriverPhoto, uploadDriverPhoto, removeDriverPhoto } from "@/server/services/profile";
export const GET = api({ auth: "driver" }, async ({ session }) => {
  const file = await readDriverPhoto(session!.driver!);
  return file ? new Response(new Uint8Array(file.bytes), { headers: { "content-type": file.contentType, "cache-control": "no-store", "x-content-type-options": "nosniff" } }) : apiError(404, "no_photo", "Kein Profilfoto.");
});
export const PUT = api({ auth: "driver", rateLimit: { key: "app-photo", limit: 10, windowMs: 600000 } }, async ({ request, session }) => {
  const reader = request.body?.getReader(); if (!reader) return apiError(400, "empty", "Bitte wähle ein Bild.");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
    if (size > 5 * 1024 * 1024) { await reader.cancel(); return apiError(413, "too_large", "Das Bild ist zu groß."); } chunks.push(part.value); }
  await uploadDriverPhoto(session!.driver!, Buffer.concat(chunks)); return { ok: true };
});
export const DELETE = api({ auth: "driver" }, async ({ session }) => { await removeDriverPhoto(session!.driver!); return { ok: true }; });
