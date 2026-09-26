import "server-only";

/**
 * Simples In-Memory Rate Limiting (§20, §92).
 * Reicht fuer den MVP auf einer einzelnen Instanz. Bei mehreren Instanzen
 * gehoert das spaeter in Redis/Upstash.
 */
type Bucket = { count: number; resetAt: number };

const g = globalThis as typeof globalThis & { __ldBuckets?: Map<string, Bucket> };
const buckets = (g.__ldBuckets ??= new Map<string, Bucket>());

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export async function clientKey(prefix: string): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}`;
}
