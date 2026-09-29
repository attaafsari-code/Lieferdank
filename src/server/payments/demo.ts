import "server-only";
import type { PaymentProvider } from "./types";
import { isDemoDatabase } from "@/lib/db";
import { isProductionRuntime } from "@/lib/runtime";

function assertIsolatedDemo(): void {
  if (isProductionRuntime() || (!isDemoDatabase() && process.env.ALLOW_DEMO_SUPABASE_TEST_PROJECT !== "true")) {
    throw new Error("Demo-Zahlungen erfordern eine isolierte Testumgebung.");
  }
}

/**
 * Testmodus: simuliert den kompletten Zahlungsablauf ohne echtes Geld.
 * Der Kunde landet auf einer nachgebauten Bezahlmaske und kann Erfolg oder
 * Abbruch auslösen – so sind auch Fehlerpfade testbar.
 */
export const demoPaymentProvider: PaymentProvider = {
  id: "demo",
  isSandbox: true,
  methodsLabel: "Testzahlung",

  async createPayment(input) {
    assertIsolatedDemo();
    return { providerPaymentId: `demo_${input.paymentId}`, redirectUrl: `/zahlung/${input.paymentId}` };
  },
  async refundPayment() {},
  async createConnectedAccount({ driverId }) {
    assertIsolatedDemo();
    return `demo_acct_${driverId.slice(0, 8)}`;
  },
  async onboardDriver({ accountId, returnUrl }) {
    assertIsolatedDemo();
    return { accountId, url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}demo_onboarding=ok` };
  },
  async isAccountReady() {
    return true;
  },
};
