import { describe, expect, it } from "vitest";
import { dailyVisitorHash, readVisitorToken, visitorFromToken } from "@/server/visitor";

describe("anonyme Danke-Kennung", () => {
  it("akzeptiert nur unveränderte, signierte Kennungen", () => {
    const first = visitorFromToken(undefined);
    expect(first.newToken).toBeTruthy();
    expect(readVisitorToken(first.newToken!)).toBe(first.id);
    expect(visitorFromToken(first.newToken!).newToken).toBeNull();
    expect(readVisitorToken(`f${first.newToken!.slice(1)}`)).toBeNull();
    expect(readVisitorToken("invalid")).toBeNull();
  });

  it("speichert pro Fahrer und Tag unterschiedliche, nicht rückrechenbare Hashes", () => {
    const id = "a".repeat(32);
    const a = dailyVisitorHash(id, "fahrer-a", "2026-09-30");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain(id);
    expect(dailyVisitorHash(id, "fahrer-b", "2026-09-30")).not.toBe(a);
    expect(dailyVisitorHash(id, "fahrer-a", "2026-10-01")).not.toBe(a);
  });
});
