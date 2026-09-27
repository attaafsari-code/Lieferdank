import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

afterEach(() => vi.unstubAllEnvs());

describe("Produktions-Health-Check", () => {
  it("meldet Demo-Zahlung und fehlenden Mailversand als nicht bereit", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-value");
    vi.stubEnv("AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
    vi.stubEnv("PAYMENT_PROVIDER", "demo");
    vi.stubEnv("RESEND_API_KEY", "");
    const response = GET();
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
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "local-test-value");
    vi.stubEnv("RESEND_API_KEY", "local-test-value");
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, database: "supabase", payments: "stripe", mail: "resend" });
  });

  it("akzeptiert in Production keinen Stripe-Testschlüssel als Live-Checkout", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("LIEFERDANK_DB", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-test-value");
    vi.stubEnv("AUTH_SECRET", "local-test-secret-with-at-least-32-characters");
    vi.stubEnv("PAYMENT_PROVIDER", "stripe");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "local-test-value");
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "local-test-value");
    vi.stubEnv("RESEND_API_KEY", "local-test-value");
    expect(GET().status).toBe(503);
  });
});
