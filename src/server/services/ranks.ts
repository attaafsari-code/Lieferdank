import "server-only";
import { getDb, isDemoDatabase } from "@/lib/db";
import { supabaseClient } from "@/lib/db/supabase";
import type { DriverProfile, ThankYou, Tip, User } from "@/lib/db/types";
import { isUuid, newId } from "@/lib/id";
import { rankProgress, REWARD_THRESHOLDS, type RankProgress } from "@/lib/ranks";
import { ServiceError } from "../errors";
import { logAdminAction } from "./admin";
import { z } from "zod";

/** Accepted free thanks and still-valid paid thanks; messages never change eligibility. */
export function validRankThanks(driver: Pick<DriverProfile, "id" | "userId">, thanks: ThankYou[], tips: Tip[]): ThankYou[] {
  const paid = new Set(tips.filter(t => t.driverId === driver.id && t.paymentStatus === "succeeded" && (t.refundedCents ?? 0) < t.grossCents).map(t => t.id));
  const seen = new Set<string>();
  return thanks.filter(t => {
    if (t.driverId !== driver.id || t.customerId === driver.userId || (t.tipId !== null && !paid.has(t.tipId)) || seen.has(t.id)) return false;
    seen.add(t.id); return true;
  });
}

export async function getDriverRank(driverId: string): Promise<RankProgress> {
  if (!isUuid(driverId)) throw new ServiceError("not_found", "Profil nicht gefunden.", 404);
  if (!isDemoDatabase()) {
    // Read-only security-invoker aggregate, accessible only to service_role. No PII leaves this service.
    const { data, error } = await supabaseClient().from("driver_rank_counts").select("thank_you_count").eq("id", driverId).maybeSingle();
    if (error) throw new ServiceError("rank_unavailable", "Dein Rang ist gerade nicht verfügbar.", 503);
    if (!data) throw new ServiceError("not_found", "Profil nicht gefunden.", 404);
    return rankProgress(Number(data.thank_you_count));
  }
  const db = getDb(); const driver = await db.driverProfiles.get(driverId);
  if (!driver) throw new ServiceError("not_found", "Profil nicht gefunden.", 404);
  const [thanks, tips] = await Promise.all([db.thankYous.findMany({ where: { driverId } }), db.tips.findMany({ where: { driverId } })]);
  return rankProgress(validRankThanks(driver, thanks, tips).length);
}

export async function syncRewardEntitlements(driverId: string, progress: RankProgress): Promise<void> {
  const table = getDb().rewardEntitlements;
  for (const threshold of REWARD_THRESHOLDS.filter(t => progress.count >= t)) {
    if (await table.findOne({ driverId, threshold })) continue;
    try { await table.insert({ id: newId(), driverId, threshold, unlockedAt: new Date().toISOString(), claimedAt: null }); }
    catch (error) { if (!await table.findOne({ driverId, threshold })) throw error; }
  }
}

const draftSchema = z.object({ threshold: z.number().int().refine(v => (REWARD_THRESHOLDS as readonly number[]).includes(v)),
  contentDraft: z.string().trim().max(1000), conditionsDraft: z.string().trim().max(4000), reason: z.string().trim().min(3).max(250), updatedAt: z.string().datetime().nullable() });

export async function saveRewardDraft(actor: User, input: z.input<typeof draftSchema>) {
  if (actor.role !== "admin" || actor.blockedAt) throw new ServiceError("forbidden", "Nur für Administratoren.", 403);
  const fields = draftSchema.parse(input); const table = getDb().rewardDefinitions;
  const previous = await table.findOne({ threshold: fields.threshold });
  if ((previous?.updatedAt ?? null) !== fields.updatedAt) throw new ServiceError("draft_changed", "Der Entwurf hat sich geändert. Bitte neu laden.", 409);
  // A failure to write the audit trail must prevent the change. Do not log draft contents.
  await logAdminAction(actor, previous?.id ?? String(fields.threshold), "reward_draft_update", fields.reason);
  const patch = { contentDraft: fields.contentDraft, conditionsDraft: fields.conditionsDraft,
    updatedAt: new Date(Math.max(Date.now(), previous ? Date.parse(previous.updatedAt) + 1 : 0)).toISOString() };
  if (previous) {
    if (!await table.updateIf(previous.id, { updatedAt: previous.updatedAt }, patch)) throw new ServiceError("draft_changed", "Der Entwurf hat sich geändert. Bitte neu laden.", 409);
  } else {
    try { await table.insert({ id: newId(), threshold: fields.threshold, ...patch }); }
    catch (error) { if (await table.findOne({ threshold: fields.threshold })) throw new ServiceError("draft_changed", "Der Entwurf hat sich geändert. Bitte neu laden.", 409); throw error; }
  }
  return patch.updatedAt;
}

export async function rankAdminOverview(actor: User, page = 0) {
  if (actor.role !== "admin" || actor.blockedAt) throw new ServiceError("forbidden", "Nur für Administratoren.", 403);
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw new ServiceError("invalid_page", "Ungültige Seite.", 400);
  const db = getDb(); let counts: { id: string; count: number }[];
  if (!isDemoDatabase()) {
    const { data, error } = await supabaseClient().from("driver_rank_counts").select("id,thank_you_count").order("id").range(page * 50, page * 50 + 50);
    if (error) throw new ServiceError("rank_unavailable", "Ränge sind gerade nicht verfügbar.", 503);
    counts = (data ?? []).map(row => ({ id: String(row.id), count: Number(row.thank_you_count) }));
  } else {
    const drivers = (await db.driverProfiles.findMany({ orderBy: "id" })).slice(page * 50, page * 50 + 51);
    const ids = drivers.map(d => d.id);
    const [thanks, tips] = await Promise.all([db.thankYous.findMany({ in: { field: "driverId", values: ids } }), db.tips.findMany({ in: { field: "driverId", values: ids } })]);
    counts = drivers.map(driver => ({ id: driver.id, count: validRankThanks(driver, thanks, tips).length }));
  }
  const hasMore = counts.length > 50; counts = counts.slice(0, 50);
  const ids = counts.map(row => row.id);
  const drivers = ids.length ? await db.driverProfiles.findMany({ in: { field: "id", values: ids } }) : [];
  return { hasMore, items: counts.flatMap(row => {
    const driver = drivers.find(d => d.id === row.id);
    return driver ? [{ code: driver.code, active: driver.active, progress: rankProgress(row.count), rewardThresholds: REWARD_THRESHOLDS.filter(t => row.count >= t) }] : [];
  }) };
}
