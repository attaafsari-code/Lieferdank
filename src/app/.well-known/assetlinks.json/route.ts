export const dynamic = "force-dynamic";
export async function GET() {
  const fingerprints = (process.env.ANDROID_APP_SHA256 ?? "").split(",").map(x => x.trim()).filter(x => /^([A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(x));
  return Response.json(fingerprints.length ? [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "de.lieferdank.driver", sha256_cert_fingerprints: fingerprints } }] : [], { headers: { "cache-control": "public, max-age=300" } });
}
