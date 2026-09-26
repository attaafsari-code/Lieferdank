import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getDb } from "@/lib/db";
import { confirmPayment, failPayment, markRefunded } from "@/server/services/thanks";
import { errorMessage, logEvent } from "@/server/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Einziger Ort, an dem eine Stripe-Zahlung als erfolgreich gilt.
 * Die Rückkehr-URL des Kunden ist keine Bestätigung – sie ist manipulierbar.
 * Alle Handler sind idempotent, weil Stripe Ereignisse mehrfach zustellt.
 */
export async function POST(request: Request) {
  // Stripe signiert Plattform- und Connect-Ereignisse mit unterschiedlichen Secrets.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (value): value is string => Boolean(value),
  );
  if (secrets.length === 0 || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Webhook nicht konfiguriert." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signatur fehlt." }, { status: 400 });

  const { stripeClient } = await import("@/server/payments/stripe");
  const body = await request.text();
  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripeClient().webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // Nächstes Secret probieren.
    }
  }
  if (!event) {
    await logEvent("warning", "stripe-webhook", "Ungültige Signatur abgewiesen");
    return NextResponse.json({ error: "Signatur ungültig." }, { status: 400 });
  }

  try {
    await handle(event);
  } catch (error) {
    // 500 → Stripe stellt das Ereignis später erneut zu.
    await logEvent("error", "stripe-webhook", `Verarbeitung fehlgeschlagen: ${event.type}`, {
      eventId: event.id,
      error: errorMessage(error),
    });
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function handle(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      if (!paymentId || session.payment_status !== "paid") return;
      const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      await confirmPayment(paymentId, {
        providerIntentId: intent ?? null,
        method: session.payment_method_types?.[0] ?? null,
      });
      return;
    }

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const paymentId = event.data.object.metadata?.paymentId;
      if (paymentId) await failPayment(paymentId, event.type === "checkout.session.expired" ? "Abgelaufen" : "Zahlung fehlgeschlagen");
      return;
    }

    case "charge.refunded": {
      const charge = event.data.object;
      const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (intent) await markRefunded(intent);
      return;
    }

    case "account.updated": {
      const account = event.data.object;
      const driverId = account.metadata?.driverId;
      if (driverId) {
        await getDb().driverProfiles.update(driverId, {
          payoutReady: Boolean(account.payouts_enabled && account.details_submitted),
          updatedAt: new Date().toISOString(),
        });
      }
      return;
    }
  }
}
