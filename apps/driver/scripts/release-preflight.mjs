/** No credentials or user data: prevent a production app build against a missing/disabled API. */
export async function releasePreflight(fetcher = fetch) {
  const base = 'https://lieferdank.de';
  const health = await fetcher(`${base}/api/health`, { signal: AbortSignal.timeout(15000) });
  const status = await health.json().catch(() => null);
  if (!health.ok || status?.ok !== true) throw new Error('LieferDank Production Health ist nicht bereit.');
  // Invalid input must be rejected before authentication/session creation. No account or payment is created.
  const login = await fetcher(`${base}/api/v1/auth/mobile/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000)
  });
  const body = await login.json().catch(() => null);
  if (login.status !== 400 || body?.error?.code !== 'invalid_input')
    throw new Error('Native Production-API fehlt oder ist nicht freigeschaltet. App-Build nicht freigeben.');
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  releasePreflight().then(() => console.info('PASS: LieferDank Production Health und native Login-Validierung.'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
