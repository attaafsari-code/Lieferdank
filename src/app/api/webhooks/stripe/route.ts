import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getDb } from "@/lib/db";
import { confirmPayment, failPayment, markDisputed, markRefunded } from "@/server/services/thanks";
import { errorMessage, logEvent } from "@/server/events";
import { stripeAccountReady } from "@/server/payments/stripe";
import type { Payment } from "@/lib/db/types";
import { isUuid } from "@/lib/id";
import { splitTip } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_WEBHOOK_BYTES = 256 * 1024;

async function boundedBody(request: Request): Promise<Buffer | null> {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_WEBHOOK_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

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
  if (secrets.length !== 2 || secrets[0].value === secrets[1].value || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Webhook nicht konfiguriert." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signatur fehlt." }, { status: 400 });
  const declaredSize = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Webhook zu groß." }, { status: 413 });
  }

  const { stripeClient } = await import("@/server/payments/stripe");
  const body = await boundedBody(request);
  if (!body) return NextResponse.json({ error: "Webhook zu groß." }, { status: 413 });
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
  if ((source === "connect") !== Boolean(event.account) ||
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

async function matchedPayment(paymentId: string | undefined, event: Stripe.Event): Promise<Payment | null> {
  if (!paymentId || !isUuid(paymentId)) {
    await logEvent("warning", "stripe-webhook", "Unbekanntes Stripe-Ereignis ignoriert", { eventId: event.id, type: event.type });
    return null;
  }
  const payment = await getDb().payments.get(paymentId);
  if (!payment || payment.provider !== "stripe") {
    await logEvent("warning", "stripe-webhook", "Fremde Zahlung ignoriert", { eventId: event.id, type: event.type });
    return null;
  }
  if (payment.purpose === "tip") {
    const tip = await getDb().tips.get(payment.referenceId);
    if (!tip || !event.account || tip.destinationAccountId !== event.account) {
      throw new Error("Connect-Ereignis gehört nicht zum Zustellerkonto.");
    }
  } else if (event.account) {
    throw new Error("Karten-Zahlung darf kein Connect-Ereignis sein.");
  }
  return payment;
}

async function paymentIntentForEvent(intent: string, event: Stripe.Event): Promise<Stripe.PaymentIntent | null> {
  const { stripeClient } = await import("@/server/payments/stripe");
  try {
    return await stripeClient().paymentIntents.retrieve(intent, {}, event.account ? { stripeAccount: event.account } : {});
  } catch (error) {
    // Fremde/gelöschte Stripe-Ressourcen sind keine Lieferdank-Zahlungen.
    // Rechte- und Netzwerkfehler bleiben 500, damit Stripe erneut zustellt.
    if ((error as { code?: unknown })?.code !== "resource_missing") throw error;
    await logEvent("warning", "stripe-webhook", "Unbekannter PaymentIntent ignoriert", { eventId: event.id, type: event.type });
    return null;
  }
}

async function handle(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const paymentId = session.metadata?.paymentId;
      if (session.payment_status !== "paid") return;
      let payment = await matchedPayment(paymentId, event);
      if (!payment) return;
      if (payment.amountCents !== session.amount_total || payment.currency.toLowerCase() !== session.currency ||
          payment.purpose !== session.metadata?.purpose || payment.referenceId !== session.metadata?.referenceId) {
        throw new Error("Checkout-Session stimmt nicht mit der vorgemerkten Zahlung überein.");
      }
      // Stripe kann die Zahlung bestätigen, nachdem das Speichern der Session-ID
      // lokal fehlgeschlagen ist. Nur der signierte, vollständig abgeglichene
      // Webhook darf die fehlende ID einmalig nachtragen.
      if (!payment.providerPaymentId) {
        await getDb().payments.updateIf(payment.id, { providerPaymentId: null }, { providerPaymentId: session.id });
        payment = await getDb().payments.get(payment.id);
      }
      if (payment?.providerPaymentId !== session.id) {
        throw new Error("Checkout-Session gehört zu einer anderen Zahlung.");
      }
      if (payment.status === "refunded" || payment.status === "review_required") return;
      const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!intent) throw new Error("Bezahlte Checkout-Session ohne PaymentIntent.");
      // Ein Connected-Account-Inhaber kann eigene Stripe-Zahlungen auslösen.
      // Deshalb auch den tatsächlichen Intent einschließlich Application Fee
      // unter genau diesem Konto prüfen, statt nur Session-Metadaten zu glauben.
      const { stripeClient } = await import("@/server/payments/stripe");
      const actual = await stripeClient().paymentIntents.retrieve(intent, {}, event.account ? { stripeAccount: event.account } : {});
      if (actual.status !== "succeeded" || actual.amount !== payment.amountCents ||
          actual.currency.toLowerCase() !== payment.currency.toLowerCase() ||
          actual.metadata?.paymentId !== payment.id || actual.metadata?.purpose !== payment.purpose ||
          actual.metadata?.referenceId !== payment.referenceId ||
          (payment.purpose === "tip" && actual.application_fee_amount !== splitTip(payment.amountCents).platformGrossFeeCents) ||
          (payment.purpose === "card_order" && Boolean(actual.application_fee_amount))) {
        throw new Error("PaymentIntent oder Application Fee stimmt nicht mit Checkout überein.");
      }
      await confirmPayment(payment.id, {
        providerIntentId: intent,
        method: session.payment_method_types?.[0] ?? null,
      });
      return;
    }

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const paymentId = event.data.object.metadata?.paymentId;
      const payment = await matchedPayment(paymentId, event);
      if (payment && payment.providerPaymentId === event.data.object.id) {
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
        const paymentIntent = await paymentIntentForEvent(intent, event);
        if (!paymentIntent) return;
        const paymentId = paymentIntent.metadata?.paymentId;
        const payment = await matchedPayment(paymentId, event);
        if (!payment) return;
        if (payment.amountCents !== charge.amount ||
            charge.currency?.toLowerCase() !== payment.currency.toLowerCase() ||
            payment.purpose !== paymentIntent.metadata?.purpose || payment.referenceId !== paymentIntent.metadata?.referenceId) {
          throw new Error("Erstattung stimmt nicht mit der vorgemerkten Zahlung überein.");
        }
        await markRefunded(intent, paymentId, charge.amount_refunded);
      }
      return;
    }

    case "charge.dispute.created":
    case "charge.dispute.closed":
    case "charge.dispute.funds_withdrawn":
    case "charge.dispute.funds_reinstated": {
      const dispute = event.data.object;
      const { stripeClient } = await import("@/server/payments/stripe");
      let intent = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
      if (!intent && dispute.charge) {
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
        const charge = await stripeClient().charges.retrieve(chargeId, {}, event.account ? { stripeAccount: event.account } : {});
        intent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      }
      if (!intent) {
        await logEvent("warning", "stripe-webhook", "Streitfall ohne PaymentIntent ignoriert", { eventId: event.id });
        return;
      }
      const paymentIntent = await paymentIntentForEvent(intent, event);
      if (!paymentIntent) return;
      const paymentId = paymentIntent.metadata?.paymentId;
      const payment = await matchedPayment(paymentId, event);
      if (!payment) return;
      if (payment.amountCents !== paymentIntent.amount ||
          payment.currency.toLowerCase() !== paymentIntent.currency ||
          payment.purpose !== paymentIntent.metadata?.purpose || payment.referenceId !== paymentIntent.metadata?.referenceId) {
        throw new Error("Streitfall stimmt nicht mit der vorgemerkten Zahlung überein.");
      }
      await markDisputed(intent, paymentId);
      return;
    }

    case "account.updated": {
      const account = event.data.object;
      if (account.id !== event.account) {
        await logEvent("warning", "stripe-webhook", "Fremdes Connect-Konto ignoriert", { eventId: event.id });
        return;
      }
      const driverId = account.metadata?.driverId;
      if (isUuid(driverId)) {
        const driver = await getDb().driverProfiles.get(driverId);
        if (driver?.payoutAccountId === account.id) {
          await getDb().driverProfiles.update(driverId, {
            payoutReady: stripeAccountReady(account),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      return;
    }
  }
}
