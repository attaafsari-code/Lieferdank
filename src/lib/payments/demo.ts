import "server-only";
import { PROVIDER_FEE_FIXED_CENTS, PROVIDER_FEE_PERCENT } from "../money";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  OnboardingLink,
  PaymentIntentStatus,
  PaymentProvider,
  ProviderFees,
} from "./types";

/**
 * Demo-Provider (§81). Simuliert den kompletten Zahlungsablauf ohne echtes Geld.
 * Der Kunde landet auf einer nachgebauten Bezahlmaske und kann Erfolg oder
 * Fehlschlag ausloesen -- damit sind auch Fehlerpfade testbar.
 */
export const demoPaymentProvider: PaymentProvider = {
  id: "demo",
  isSandbox: true,

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const providerPaymentId = `demo_${input.tipId}`;
    return {
      providerPaymentId,
      redirectUrl: `/zahlung/${input.tipId}`,
      status: "pending",
    };
  },

  async getPaymentStatus(): Promise<PaymentIntentStatus> {
    return "pending";
  },

  async confirmPayment(): Promise<PaymentIntentStatus> {
    return "succeeded";
  },

  async refundPayment(): Promise<void> {},

  async createConnectedAccount({ driverId }): Promise<string> {
    return `demo_acct_${driverId.slice(0, 8)}`;
  },

  async onboardDriver({ accountId, returnUrl }): Promise<OnboardingLink> {
    return { accountId, url: `${returnUrl}?demo_onboarding=ok` };
  },

  async isAccountReady(): Promise<boolean> {
    return true;
  },

  async createPayout(): Promise<void> {},

  getFees(): ProviderFees {
    return {
      percent: PROVIDER_FEE_PERCENT,
      fixedCents: PROVIDER_FEE_FIXED_CENTS,
      label: "Demo (kalkuliert mit Stripe-DE-Kartensatz)",
    };
  },
};
