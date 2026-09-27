import "server-only";
import { demoPaymentProvider } from "./demo";
import { stripePaymentProvider } from "./stripe";
import type { PaymentProvider } from "./types";

let cached: PaymentProvider | null = null;

/** Wählt den Anbieter über PAYMENT_PROVIDER (demo | stripe). */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  if (isDemoPayment()) {
    cached = demoPaymentProvider;
  } else {
    cached = stripePaymentProvider;
  }
  return cached;
}

export function isDemoPayment(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "demo").toLowerCase() !== "stripe";
}

export type * from "./types";
