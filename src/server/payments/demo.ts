import "server-only";
import type { PaymentProvider } from "./types";

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
    return { providerPaymentId: `demo_${input.paymentId}`, redirectUrl: `/zahlung/${input.paymentId}` };
  },
  async refundPayment() {},
  async createConnectedAccount({ driverId }) {
    return `demo_acct_${driverId.slice(0, 8)}`;
  },
  async onboardDriver({ accountId, returnUrl }) {
    return { accountId, url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}demo_onboarding=ok` };
  },
  async isAccountReady() {
    return true;
  },
  async createPayout({ payoutId }) {
    return `demo_tr_${payoutId.slice(0, 8)}`;
  },
};
