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
  const secrets = [
    { source: "platform" as const, value: process.env.STRIPE_WEBHOOK_SECRET },
    { source: "connect" as const, value: process.env.STRIPE_CONNECT_WEBHOOK_SECRET },
  ].filter((item): item is { source: "platform" | "connect"; value: string } => Boolean(item.value));
  if (secrets.length !== 2 || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Webhook nicht konfiguriert." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signatur fehlt." }, { status: 400 });

  const { stripeClient } = await import("@/server/payments/stripe");
  const body = await request.text();
  let event: Stripe.Event | null = null;
  let source: "platform" | "connect" | null = null;
  for (const candidate of secrets) {
    try {
      event = stripeClient().webhooks.constructEvent(body, signature, candidate.value);
      source = candidate.source;
      break;
    } catch {
      // Nächstes Secret probieren.
    }
  }
  if (!event) {
    await logEvent("warning", "stripe-webhook", "Ungültige Signatur abgewiesen");
    return NextResponse.json({ error: "Signatur ungültig." }, { status: 400 });
  }
  // Ein gültiges Connect-Ereignis darf keine Plattformzahlung bestätigen.
  if ((source === "connect") !== Boolean(event.account) ||
      (source === "connect" && event.type !== "account.updated") ||
      (source === "platform" && event.type === "account.updated")) {
    return NextResponse.json({ error: "Webhook-Quelle ungültig." }, { status: 400 });
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
      let payment = await getDb().payments.get(paymentId);
      if (!payment || payment.provider !== "stripe" ||
          payment.amountCents !== session.amount_total || payment.currency.toLowerCase() !== session.currency ||
          payment.purpose !== session.metadata?.purpose || payment.referenceId !== session.metadata?.referenceId) {
        throw new Error("Checkout-Session stimmt nicht mit der vorgemerkten Zahlung überein.");
      }
      // Stripe kann die Zahlung bestätigen, nachdem das Speichern der Session-ID
      // lokal fehlgeschlagen ist. Nur der signierte, vollständig abgeglichene
      // Webhook darf die fehlende ID einmalig nachtragen.
      if (!payment.providerPaymentId) {
        await getDb().payments.updateIf(payment.id, { providerPaymentId: null }, { providerPaymentId: session.id });
        payment = await getDb().payments.get(paymentId);
      }
      if (payment?.providerPaymentId !== session.id) {
        throw new Error("Checkout-Session gehört zu einer anderen Zahlung.");
      }
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
      const payment = paymentId ? await getDb().payments.get(paymentId) : null;
      if (payment && payment.provider === "stripe" && payment.providerPaymentId === event.data.object.id) {
        await failPayment(payment.id, event.type === "checkout.session.expired" ? "Abgelaufen" : "Zahlung fehlgeschlagen");
      }
      return;
    }

    case "charge.refunded": {
      const charge = event.data.object;
      const intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (intent) {
        // Ein Refund kann vor dem Checkout-Webhook eintreffen. Die vom Server
        // gesetzte PaymentIntent-Metadaten-ID erlaubt trotzdem die Zuordnung.
        const { stripeClient } = await import("@/server/payments/stripe");
        const paymentIntent = await stripeClient().paymentIntents.retrieve(intent);
        const paymentId = paymentIntent.metadata?.paymentId;
        const payment = paymentId ? await getDb().payments.get(paymentId) : null;
        if (!payment || payment.provider !== "stripe" || payment.amountCents !== charge.amount ||
            payment.purpose !== paymentIntent.metadata?.purpose || payment.referenceId !== paymentIntent.metadata?.referenceId) {
          throw new Error("Erstattung stimmt nicht mit der vorgemerkten Zahlung überein.");
        }
        if (charge.amount_refunded < charge.amount) {
          await logEvent("warning", "stripe-webhook", "Teil-Erstattung erfordert manuelle Abstimmung", {
            paymentId, amountRefundedCents: charge.amount_refunded,
          });
        }
        await markRefunded(intent, paymentId);
      }
      return;
    }

    case "account.updated": {
      const account = event.data.object;
      if (account.id !== event.account) throw new Error("Connect-Konto stimmt nicht mit dem Ereignis überein.");
      const driverId = account.metadata?.driverId;
      if (driverId) {
        const driver = await getDb().driverProfiles.get(driverId);
        if (driver?.payoutAccountId === account.id) {
          await getDb().driverProfiles.update(driverId, {
            payoutReady: Boolean(account.payouts_enabled && account.details_submitted),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      return;
    }
  }
}
