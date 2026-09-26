import "server-only";
import { headers } from "next/headers";
import { rateLimited } from "./errors";

/**
 * Einfaches Rate Limiting im Arbeitsspeicher.
 * Wirkt pro Serverinstanz – für mehrere Instanzen gehört das in Redis/Upstash.
 */
type Bucket = { count: number; resetAt: number };

const g = globalThis as typeof globalThis & { __ldBuckets?: Map<string, Bucket> };
const buckets = (g.__ldBuckets ??= new Map<string, Bucket>());

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function ipFromHeaders(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function clientKey(prefix: string): Promise<string> {
  return `${prefix}:${ipFromHeaders(await headers())}`;
}

/** Wirft einen ServiceError, wenn das Limit überschritten ist. */
export async function enforceRateLimit(prefix: string, limit: number, windowMs: number): Promise<void> {
  if (!rateLimit(await clientKey(prefix), limit, windowMs)) throw rateLimited();
}

export function enforceRateLimitFor(key: string, limit: number, windowMs: number): void {
  if (!rateLimit(key, limit, windowMs)) throw rateLimited();
}
