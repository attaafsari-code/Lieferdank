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
    vi.mocked(supabaseClient).mockReturnValueOnce({ from: () => ({ select: () => ({ limit: async () => ({ error: { message: "missing" } }) }) }) } as never);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, database: "migration_required" });
    expect(response.headers.get("cache-control")).toBe("no-store");
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
});
