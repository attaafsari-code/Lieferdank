import { NextResponse } from "next/server";
import { getSession } from "@/server/session";
import { exportUserData } from "@/server/services/profile";

/** Datenexport nach DSGVO – für Zusteller und Kunden. Ohne Passwort-Hash. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const payload = await exportUserData(session.user);
  const suffix = session.driver?.code ?? "konto";
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="lieferdank-datenexport-${suffix}.json"`,
      "cache-control": "no-store",
    },
  });
}
