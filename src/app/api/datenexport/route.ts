import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getStore } from "@/lib/db";

/** Datenexport nach DSGVO (§47). Enthaelt keine Passwort-Hashes. */
export async function GET() {
  const session = await getSession();
  if (!session?.driver) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const store = getStore();
  const [tips, thankYous, milestones, verification] = await Promise.all([
    store.listTipsByDriver(session.driver.id),
    store.listThankYousByDriver(session.driver.id),
    store.listMilestonesByDriver(session.driver.id),
    store.getVerificationByUserId(session.user.id),
  ]);

  const { passwordHash: _passwordHash, ...user } = session.user;

  const payload = {
    exportiertAm: new Date().toISOString(),
    konto: user,
    zustellerProfil: session.driver,
    verifizierung: verification,
    trinkgelder: tips,
    danke: thankYous,
    meilensteine: milestones,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="lieferdank-datenexport-${session.driver.code}.json"`,
      "cache-control": "no-store",
    },
  });
}
