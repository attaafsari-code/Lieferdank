export const dynamic = "force-dynamic";
export async function GET() {
  const team = process.env.APPLE_TEAM_ID;
  const appID = team && /^[A-Z0-9]{10}$/.test(team) ? `${team}.de.lieferdank.driver` : null;
  return Response.json({ applinks: { details: appID ? [{ appIDs: [appID], components: [{ "/": "/app/*" }, { "/": "/passwort-neu" }, { "/": "/email-bestaetigen" }] }] : [] } }, { headers: { "cache-control": "public, max-age=300" } });
}
