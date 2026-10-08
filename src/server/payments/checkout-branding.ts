import "server-only";
import { PRODUCTION_URL } from "@/lib/base-url";

/**
 * Offizielles Checkout-Session-Branding statt Änderungen am Standard-Konto.
 * https://docs.stripe.com/payments/checkout/customization/appearance
 * Das installierte SDK enthält die neueren, auch mit unserer API-Version akzeptierten
 * Branding-Felder noch nicht als Typ. Dieser kleine Parameter-Typ hält sie explizit;
 * die globale Stripe-API-Version und die Webhook-Version bleiben unverändert.
 * Der Zusteller bleibt Merchant; der Artikel nennt weiterhin den Empfänger.
 */
export const CHECKOUT_BRANDING = {
  display_name: "Lieferdank",
  background_color: "#ffffff",
  button_color: "#1a5ce0",
  font_family: "inter",
  border_style: "rounded",
  icon: { type: "url", url: `${PRODUCTION_URL}/pwa/icon-512.png` },
  logo: { type: "url", url: `${PRODUCTION_URL}/brand/checkout-logo.png` },
} as const;
