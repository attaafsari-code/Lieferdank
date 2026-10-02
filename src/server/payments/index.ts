import "server-only";
import { demoPaymentProvider } from "./demo";
import { stripePaymentProvider } from "./stripe";
import type { PaymentProvider } from "./types";

/** Wählt den Anbieter über PAYMENT_PROVIDER (demo | stripe). */
export function getPaymentProvider(): PaymentProvider {
  return isDemoPayment() ? demoPaymentProvider : stripePaymentProvider;
}

/** Für Vorgänge, die an ihren ursprünglichen Anbieter gebunden sind (Erstattungen). */
export function paymentProviderById(id: string): PaymentProvider {
  if (id === stripePaymentProvider.id) return stripePaymentProvider;
  if (id === demoPaymentProvider.id) return demoPaymentProvider;
  throw new Error("Unbekannter Zahlungsanbieter.");
}

export function isDemoPayment(): boolean {
  return (process.env.PAYMENT_PROVIDER ?? "demo").toLowerCase() !== "stripe";
}

export type * from "./types";
