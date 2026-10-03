import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
import { supabaseClient } from "@/lib/db/supabase";

vi.mock("@/lib/db/supabase", () => ({ supabaseClient: vi.fn() }));
vi.mocked(supabaseClient).mockReturnValue({ from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }) } as never);

afterEach(() => vi.unstubAllEnvs());

describe("Produktions-Health-Check", () => {
  it("behandelt auch selbst gehostetes NODE_ENV=production als Produktion", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("PAYMENT_PROVIDER", "demo");
    vi.stubEnv("RESEND_API_KEY", "");
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).payments).toBe("demo");
  });
  it("meldet Demo-Zahlung und fehlenden Mailversand als nicht bereit", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-value");
    vi.stubEnv("AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
    vi.stubEnv("PAYMENT_PROVIDER", "demo");
    vi.stubEnv("RESEND_API_KEY", "");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, database: "supabase", payments: "demo", mail: "log" });
  });

  it("meldet erst bei vollständig gesetzten Produktionsvariablen Bereitschaft", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-value");
    vi.stubEnv("AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "local-test-value");
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "local-test-connect-value");
    vi.stubEnv("RESEND_API_KEY", "local-test-value");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, database: "supabase", payments: "stripe", mail: "resend" });
  });

  it("akzeptiert in Production keinen Stripe-Testschlüssel als Live-Checkout", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-value");
    vi.stubEnv("AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "local-test-value");
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "local-test-connect-value");
    vi.stubEnv("RESEND_API_KEY", "local-test-value");
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).payments).toBe("stripe_not_ready");
  });

  it("meldet bei fehlender Payment-Migration keine Bereitschaft", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-value");
    vi.stubEnv("AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "local-test-value");
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "local-test-connect-value");
    vi.stubEnv("RESEND_API_KEY", "local-test-value");
    vi.mocked(supabaseClient).mockReturnValueOnce({ from: () => ({ select: () => ({ limit: async () => ({ error: { code: "42703", message: "column does not exist" } }) }) }) } as never);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, database: "migration_required" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("meldet ohne eine der Spalten der letzten Migrationen keine Bereitschaft", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-value");
    vi.stubEnv("AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "local-test-value");
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "local-test-connect-value");
    vi.stubEnv("RESEND_API_KEY", "local-test-value");
    // Jeweils genau eine Migration fehlt (nicht ausgeführt oder für die API noch unsichtbar).
    const columns = ["driver_profiles.payout_sync_version", "payments.refunded_amount_cents", "tips.refunded_cents, fee_refunded_cents", "users.email_verified_at"];
    const client = (missing: string | null, checked: string[] = []) => ({ from: (table: string) => ({ select: (column: string) => ({ limit: async () => {
      checked.push(`${table}.${column}`);
      return { error: `${table}.${column}` === missing ? { code: "42703", message: "column does not exist" } : null };
    } }) }) }) as never;
    for (const missing of columns) {
      const checked: string[] = [];
      vi.mocked(supabaseClient).mockReturnValueOnce(client(missing, checked));
      const response = await GET();
      expect(response.status, missing).toBe(503);
      expect(await response.json()).toMatchObject({ ok: false, database: "migration_required", payments: "stripe" });
      expect(checked.sort()).toEqual(columns);
    }
    // Sind alle Spalten erreichbar, ist der Stand bereit.
    vi.mocked(supabaseClient).mockReturnValueOnce(client(null));
    const ready = await GET();
    expect(ready.status).toBe(200);
    expect(await ready.json()).toMatchObject({ ok: true, database: "supabase" });
  });

  it("meldet eine kurze Datenbankstörung nicht als fehlende Migration und wiederholt einmal", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-value");
    vi.stubEnv("AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "local-test-value");
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "local-test-connect-value");
    vi.stubEnv("RESEND_API_KEY", "local-test-value");
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const flaky = (failure: "error" | "throw") => ({ from: (table: string) => ({ select: () => ({ limit: async () => {
      if (table !== "tips") return { error: null };
      if (failure === "throw") throw new TypeError("fetch failed");
      return { error: { code: "PGRST002", message: "Could not query the database for the schema cache. Retrying." } };
    } }) }) }) as never;

    // Erster Versuch gestört, die Wiederholung klappt: bereit.
    vi.mocked(supabaseClient).mockReturnValueOnce(flaky("error"));
    const recovered = await GET();
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toMatchObject({ ok: true, database: "supabase" });
    expect(logged).not.toHaveBeenCalled();

    // Bleibt die Störung (Fehlerantwort oder Netzwerkfehler), ist die Datenbank „unavailable“ – nicht „migration_required“.
    for (const failure of ["error", "throw"] as const) {
      vi.mocked(supabaseClient).mockReturnValueOnce(flaky(failure)).mockReturnValueOnce(flaky(failure));
      const response = await GET();
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ ok: false, database: "unavailable" });
    }
    expect(logged).toHaveBeenCalledWith("[health] Datenbankprüfung fehlgeschlagen", "unavailable",
      [expect.objectContaining({ table: "tips", code: "PGRST002" })]);
    expect(logged).toHaveBeenCalledWith("[health] Datenbankprüfung fehlgeschlagen", "unavailable",
      [expect.objectContaining({ table: "tips", code: "fetch_failed", message: "fetch failed" })]);
    expect(JSON.stringify(logged.mock.calls)).not.toMatch(/local-test|rk_live|project\.supabase\.co/);
    logged.mockRestore();
  });

  it("meldet identische Plattform- und Connect-Secrets als nicht bereit", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-value");
    vi.stubEnv("AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "same-test-secret");
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "same-test-secret");
    vi.stubEnv("RESEND_API_KEY", "local-test-value");
    expect((await GET()).status).toBe(503);
  });

  it("meldet ein fehlendes oder zu kurzes AUTH_SECRET nur als Status und gibt nie Secret-Werte aus", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project-ref-geheim.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-geheim");
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "rk_live_geheim");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_plattform_geheim");
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_connect_geheim");
    vi.stubEnv("RESEND_API_KEY", "re_geheim");
    for (const [secret, status, auth] of [["zu-kurz-geheim", 503, "missing"], ["", 503, "missing"],
      ["auth-secret-geheim-mit-mindestens-32-zeichen", 200, "configured"]] as const) {
      vi.stubEnv("AUTH_SECRET", secret);
      const response = await GET();
      expect(response.status).toBe(status);
      const body = await response.text();
      expect(JSON.parse(body)).toMatchObject({ auth });
      expect(body).not.toMatch(/geheim|supabase\.co|rk_live|whsec|re_/);
    }
  });
});
