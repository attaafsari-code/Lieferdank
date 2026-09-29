import "server-only";
import { demoPaymentProvider } from "./demo";
import { stripePaymentProvider } from "./stripe";
import type { PaymentProvider } from "./types";

/** Wählt den Anbieter über PAYMENT_PROVIDER (demo | stripe). */
export function getPaymentProvider(): PaymentProvider {
  return isDemoPayment() ? demoPaymentProvider : stripePaymentProvider;
}

export function isDemoPayment(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "demo").toLowerCase() !== "stripe";
}

export type * from "./types";
