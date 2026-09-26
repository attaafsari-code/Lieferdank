import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Store } from "./store";
import type {
  AdminAction,
  PasswordReset,
  DriverProfile,
  Milestone,
  ThankYou,
  Tip,
  User,
  Verification,
} from "./types";

/**
 * Produktiver Store auf Supabase Postgres.
 * Laeuft ausschliesslich serverseitig mit dem Service-Role-Key.
 * Das Schema liegt in supabase/schema.sql, inklusive Row Level Security (§92).
 */

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "LIEFERDANK_DB=supabase erfordert SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

/* ---------- Mapping snake_case <-> camelCase ---------- */

type Row = Record<string, unknown>;

const toUser = (r: Row): User => ({
  id: r.id as string,
  name: r.name as string,
  email: r.email as string,
  phone: (r.phone as string) ?? null,
  role: r.role as User["role"],
  passwordHash: r.password_hash as string,
  createdAt: r.created_at as string,
  blockedAt: (r.blocked_at as string) ?? null,
  blockedReason: (r.blocked_reason as string) ?? null,
  tokenVersion: (r.token_version as number) ?? 0,
});

const fromUser = (u: Partial<User>): Row => prune({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  password_hash: u.passwordHash,
  created_at: u.createdAt,
  blocked_at: u.blockedAt,
  blocked_reason: u.blockedReason,
  token_version: u.tokenVersion,
});

const toDriver = (r: Row): DriverProfile => ({
  id: r.id as string,
  userId: r.user_id as string,
  displayName: r.display_name as string,
  code: r.code as string,
  providerId: (r.provider_id as string) ?? null,
  providerVerified: Boolean(r.provider_verified),
  verification: r.verification as DriverProfile["verification"],
  active: Boolean(r.active),
  city: (r.city as string) ?? null,
  payoutAccountId: (r.payout_account_id as string) ?? null,
  payoutReady: Boolean(r.payout_ready),
  createdAt: r.created_at as string,
});

const fromDriver = (d: Partial<DriverProfile>): Row => prune({
  id: d.id,
  user_id: d.userId,
  display_name: d.displayName,
  code: d.code,
  provider_id: d.providerId,
  provider_verified: d.providerVerified,
  verification: d.verification,
  active: d.active,
  city: d.city,
  payout_account_id: d.payoutAccountId,
  payout_ready: d.payoutReady,
  created_at: d.createdAt,
});

const toTip = (r: Row): Tip => ({
  id: r.id as string,
  driverId: r.driver_id as string,
  grossCents: r.gross_cents as number,
  driverCents: r.driver_cents as number,
  platformGrossFeeCents: r.platform_gross_fee_cents as number,
  paymentProviderFeeCents: r.payment_provider_fee_cents as number,
  platformNetRevenueCents: r.platform_net_revenue_cents as number,
  currency: r.currency as string,
  paymentStatus: r.payment_status as Tip["paymentStatus"],
  payoutStatus: r.payout_status as Tip["payoutStatus"],
  provider: r.provider as string,
  providerPaymentId: (r.provider_payment_id as string) ?? null,
  destinationAccountId: (r.destination_account_id as string) ?? null,
  createdAt: r.created_at as string,
});

const fromTip = (t: Partial<Tip>): Row => prune({
  id: t.id,
  driver_id: t.driverId,
  gross_cents: t.grossCents,
  driver_cents: t.driverCents,
  platform_gross_fee_cents: t.platformGrossFeeCents,
  payment_provider_fee_cents: t.paymentProviderFeeCents,
  platform_net_revenue_cents: t.platformNetRevenueCents,
  currency: t.currency,
  payment_status: t.paymentStatus,
  payout_status: t.payoutStatus,
  provider: t.provider,
  provider_payment_id: t.providerPaymentId,
  destination_account_id: t.destinationAccountId,
  created_at: t.createdAt,
});

const toThankYou = (r: Row): ThankYou => ({
  id: r.id as string,
  driverId: r.driver_id as string,
  presetId: (r.preset_id as string) ?? null,
  message: (r.message as string) ?? null,
  tipId: (r.tip_id as string) ?? null,
  createdAt: r.created_at as string,
});

const fromThankYou = (t: Partial<ThankYou>): Row => prune({
  id: t.id,
  driver_id: t.driverId,
  preset_id: t.presetId,
  message: t.message,
  tip_id: t.tipId,
  created_at: t.createdAt,
});

const toVerification = (r: Row): Verification => ({
  id: r.id as string,
  userId: r.user_id as string,
  identityStatus: r.identity_status as Verification["identityStatus"],
  driverStatus: r.driver_status as Verification["driverStatus"],
  documentNote: (r.document_note as string) ?? null,
  reviewNote: (r.review_note as string) ?? null,
  updatedAt: r.updated_at as string,
});

const fromVerification = (v: Verification): Row => ({
  id: v.id,
  user_id: v.userId,
  identity_status: v.identityStatus,
  driver_status: v.driverStatus,
  document_note: v.documentNote,
  review_note: v.reviewNote,
  updated_at: v.updatedAt,
});

/** Entfernt undefined, damit partielle Updates keine Spalten auf NULL setzen. */
function prune(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));
}

function unwrap(res: { data: unknown; error: { message: string } | null }): Row | null {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return (res.data as Row) ?? null;
}

/** Wie unwrap, aber fuer Abfragen, die garantiert eine Zeile liefern (insert ... single). */
function unwrapOne(res: { data: unknown; error: { message: string } | null }): Row {
  const row = unwrap(res);
  if (!row) throw new Error("Supabase: erwartete Zeile fehlt in der Antwort.");
  return row;
}

function unwrapMany(res: { data: unknown; error: { message: string } | null }): Row[] {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return (res.data as Row[]) ?? [];
}

/* ---------- Store ---------- */

export const supabaseStore: Store = {
  async getUserByEmail(email) {
    const r = unwrap(await db().from("users").select("*").ilike("email", email).maybeSingle());
    return r ? toUser(r) : null;
  },
  async getUserById(id) {
    const r = unwrap(await db().from("users").select("*").eq("id", id).maybeSingle());
    return r ? toUser(r) : null;
  },
  async createUser(user) {
    const r = unwrapOne(await db().from("users").insert(fromUser(user)).select().single());
    return toUser(r);
  },
  async updateUser(id, changes) {
    unwrap(await db().from("users").update(fromUser(changes)).eq("id", id).select().maybeSingle());
  },
  async listUsers() {
    return unwrapMany(await db().from("users").select("*").order("created_at", { ascending: false })).map(toUser);
  },

  async createPasswordReset(reset) {
    unwrap(
      await db()
        .from("password_resets")
        .insert({
          id: reset.id,
          user_id: reset.userId,
          token_hash: reset.tokenHash,
          expires_at: reset.expiresAt,
          used_at: reset.usedAt,
          created_at: reset.createdAt,
        })
        .select()
        .maybeSingle(),
    );
  },
  async getPasswordResetByTokenHash(tokenHash) {
    const r = unwrap(
      await db().from("password_resets").select("*").eq("token_hash", tokenHash).maybeSingle(),
    );
    if (!r) return null;
    const reset: PasswordReset = {
      id: r.id as string,
      userId: r.user_id as string,
      tokenHash: r.token_hash as string,
      expiresAt: r.expires_at as string,
      usedAt: (r.used_at as string) ?? null,
      createdAt: r.created_at as string,
    };
    return reset;
  },
  async markPasswordResetUsed(id) {
    unwrap(
      await db()
        .from("password_resets")
        .update({ used_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .maybeSingle(),
    );
  },
  async invalidatePasswordResets(userId) {
    unwrap(
      await db()
        .from("password_resets")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("used_at", null)
        .select()
        .maybeSingle(),
    );
  },

  async getDriverById(id) {
    const r = unwrap(await db().from("driver_profiles").select("*").eq("id", id).maybeSingle());
    return r ? toDriver(r) : null;
  },
  async getDriverByUserId(userId) {
    const r = unwrap(await db().from("driver_profiles").select("*").eq("user_id", userId).maybeSingle());
    return r ? toDriver(r) : null;
  },
  async getDriverByCode(code) {
    const r = unwrap(await db().from("driver_profiles").select("*").ilike("code", code).maybeSingle());
    return r ? toDriver(r) : null;
  },
  async createDriverProfile(profile) {
    const r = unwrapOne(await db().from("driver_profiles").insert(fromDriver(profile)).select().single());
    return toDriver(r);
  },
  async updateDriverProfile(id, changes) {
    unwrap(await db().from("driver_profiles").update(fromDriver(changes)).eq("id", id).select().maybeSingle());
  },
  async listDrivers() {
    return unwrapMany(await db().from("driver_profiles").select("*").order("created_at", { ascending: false })).map(toDriver);
  },

  async createTip(tip) {
    const r = unwrapOne(await db().from("tips").insert(fromTip(tip)).select().single());
    return toTip(r);
  },
  async getTipById(id) {
    const r = unwrap(await db().from("tips").select("*").eq("id", id).maybeSingle());
    return r ? toTip(r) : null;
  },
  async getTipByProviderPaymentId(providerPaymentId) {
    const r = unwrap(await db().from("tips").select("*").eq("provider_payment_id", providerPaymentId).maybeSingle());
    return r ? toTip(r) : null;
  },
  async updateTip(id, changes) {
    unwrap(await db().from("tips").update(fromTip(changes)).eq("id", id).select().maybeSingle());
  },
  async listTipsByDriver(driverId) {
    return unwrapMany(await db().from("tips").select("*").eq("driver_id", driverId)).map(toTip);
  },
  async listTips() {
    return unwrapMany(await db().from("tips").select("*")).map(toTip);
  },

  async createThankYou(thankYou) {
    const r = unwrapOne(await db().from("thank_yous").insert(fromThankYou(thankYou)).select().single());
    return toThankYou(r);
  },
  async getThankYouById(id) {
    const r = unwrap(await db().from("thank_yous").select("*").eq("id", id).maybeSingle());
    return r ? toThankYou(r) : null;
  },
  async updateThankYou(id, changes) {
    unwrap(await db().from("thank_yous").update(fromThankYou(changes)).eq("id", id).select().maybeSingle());
  },
  async listThankYousByDriver(driverId) {
    return unwrapMany(await db().from("thank_yous").select("*").eq("driver_id", driverId)).map(toThankYou);
  },
  async listThankYous() {
    return unwrapMany(await db().from("thank_yous").select("*")).map(toThankYou);
  },

  async createScan(driverId, id, createdAt) {
    unwrap(await db().from("scans").insert({ id, driver_id: driverId, created_at: createdAt }).select().maybeSingle());
  },
  async countScans(filter) {
    let query = db().from("scans").select("id", { count: "exact", head: true });
    if (filter?.driverId) query = query.eq("driver_id", filter.driverId);
    if (filter?.sinceIso) query = query.gte("created_at", filter.sinceIso);
    const res = await query;
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    return res.count ?? 0;
  },

  async getVerificationByUserId(userId) {
    const r = unwrap(await db().from("verifications").select("*").eq("user_id", userId).maybeSingle());
    return r ? toVerification(r) : null;
  },
  async upsertVerification(verification) {
    unwrap(await db().from("verifications").upsert(fromVerification(verification), { onConflict: "user_id" }).select().maybeSingle());
  },
  async listVerifications() {
    return unwrapMany(await db().from("verifications").select("*")).map(toVerification);
  },

  async createMilestone(milestone) {
    unwrap(await db().from("milestones").insert({
      id: milestone.id,
      driver_id: milestone.driverId,
      type: milestone.type,
      value: milestone.value,
      achieved_at: milestone.achievedAt,
    }).select().maybeSingle());
  },
  async listMilestonesByDriver(driverId) {
    return unwrapMany(await db().from("milestones").select("*").eq("driver_id", driverId)).map((r): Milestone => ({
      id: r.id as string,
      driverId: r.driver_id as string,
      type: r.type as string,
      value: r.value as number,
      achievedAt: r.achieved_at as string,
    }));
  },

  async createAdminAction(action) {
    unwrap(await db().from("admin_actions").insert({
      id: action.id,
      actor_email: action.actorEmail,
      target_id: action.targetId,
      action: action.action,
      reason: action.reason,
      created_at: action.createdAt,
    }).select().maybeSingle());
  },
  async listAdminActions() {
    return unwrapMany(await db().from("admin_actions").select("*").order("created_at", { ascending: false })).map((r): AdminAction => ({
      id: r.id as string,
      actorEmail: r.actor_email as string,
      targetId: r.target_id as string,
      action: r.action as string,
      reason: (r.reason as string) ?? null,
      createdAt: r.created_at as string,
    }));
  },
};
