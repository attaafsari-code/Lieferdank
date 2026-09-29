/** Preview deployments may use sandbox services; production may not. */
export function isProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production" ||
    (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview");
}
