import { getDb } from "@/lib/db";
import { getSession } from "@/server/session";
import { readDriverPhoto } from "@/server/services/profile";

export const dynamic = "force-dynamic";

/**
 * Liefert ein Profilfoto aus – aber nur, wenn es öffentlich ist oder der
 * Zusteller selbst bzw. ein Admin fragt. So bleibt „nur im Dashboard“ wirklich privat.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  const driver = await getDb().driverProfiles.get(driverId);
  if (!driver?.photoKey) return new Response("Nicht gefunden", { status: 404 });

  let allowed = driver.photoPublic && driver.active;
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
      "cache-control": driver.photoPublic ? "public, max-age=300" : "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
