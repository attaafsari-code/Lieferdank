import "server-only";
import { demoPaymentProvider } from "./demo";
import type { PaymentProvider } from "./types";

let cached: PaymentProvider | null = null;

/** Waehlt den Provider ueber PAYMENT_PROVIDER (demo | stripe). */
export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  const id = (process.env.PAYMENT_PROVIDER ?? "demo").toLowerCase();
  if (id === "stripe") {
    const { stripePaymentProvider } = require("./stripe") as typeof import("./stripe");
    cached = stripePaymentProvider;
  } else {
    cached = demoPaymentProvider;
  }
  return cached;
}

export function isDemoPayment(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "demo").toLowerCase() !== "stripe";
}

export type * from "./types";
