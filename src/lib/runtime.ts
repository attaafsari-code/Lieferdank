/**
 * Preview deployments may use sandbox services; production may not.
 * Auf Vercel entscheidet allein VERCEL_ENV: „preview“ und „development“ sind nie
 * Produktion, auch wenn dort mit NODE_ENV=production gebaut wird. Nur ohne
 * VERCEL_ENV (eigener Server, lokaler Produktionsstart) zählt NODE_ENV.
 */
export function isProductionRuntime(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv === "production";
  return process.env.NODE_ENV === "production";
}
