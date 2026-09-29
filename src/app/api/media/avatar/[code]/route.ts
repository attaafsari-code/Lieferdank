import { getDb } from "@/lib/db";
import { normalizeCode } from "@/lib/id";
import { getSession } from "@/server/session";
import { readDriverPhoto } from "@/server/services/profile";

export const dynamic = "force-dynamic";

/**
 * Liefert ein Profilfoto aus – aber nur, wenn es öffentlich ist oder der
 * Zusteller selbst bzw. ein Admin fragt. So bleibt „nur im Dashboard“ wirklich privat.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const driver = await getDb().driverProfiles.findOne({ code: normalizeCode(code) });
  if (!driver?.photoKey) return new Response("Nicht gefunden", { status: 404 });

  const owner = await getDb().users.get(driver.userId);
  let allowed = driver.photoPublic && driver.active && Boolean(owner && !owner.blockedAt);
  if (!allowed) {
    const session = await getSession();
    allowed = session?.user.role === "admin" || session?.driver?.id === driver.id;
  }
  if (!allowed) return new Response("Nicht gefunden", { status: 404 });

  const file = await readDriverPhoto(driver);
  if (!file) return new Response("Nicht gefunden", { status: 404 });

  return new Response(Buffer.from(file.bytes), {
    headers: {
      "content-type": file.contentType,
      // A photo may become private or the account may be blocked at any time.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
