import "server-only";
import { demoPaymentProvider } from "./demo";
import type { PaymentProvider } from "./types";

let cached: PaymentProvider | null = null;

/** Wählt den Anbieter über PAYMENT_PROVIDER (demo | stripe). */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  if (isDemoPayment()) {
    cached = demoPaymentProvider;
  } else {
    const { stripePaymentProvider } = require("./stripe") as typeof import("./stripe");
    cached = stripePaymentProvider;
  }
  return cached;
}

export function isDemoPayment(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "demo").toLowerCase() !== "stripe";
}

export type * from "./types";
