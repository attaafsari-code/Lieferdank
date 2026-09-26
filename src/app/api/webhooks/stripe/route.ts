import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStore } from "@/lib/db";
import { newId } from "@/lib/id";
import { awardMilestones } from "@/lib/milestones";
import { getDriverStats } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Einziger Ort, an dem eine Zahlung als erfolgreich gilt (§92).
 * Die Rueckkehr-URL des Kunden ist keine Bestaetigung -- sie ist manipulierbar.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!secret || !apiKey) {
    return NextResponse.json({ error: "Webhook nicht konfiguriert." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signatur fehlt." }, { status: 400 });
  }

  const stripe = new Stripe(apiKey);
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Signatur ungültig." }, { status: 400 });
  }

  const store = getStore();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const tipId = session.metadata?.tipId;
    if (!tipId) return NextResponse.json({ received: true });

    const tip = await store.getTipById(tipId);
    // Idempotent: Stripe stellt Events mehrfach zu.
    if (!tip || tip.paymentStatus === "succeeded") {
      return NextResponse.json({ received: true });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    await store.updateTip(tip.id, {
      paymentStatus: "succeeded",
      payoutStatus: "in_balance",
      providerPaymentId: session.id,
    });

    await store.createThankYou({
      id: newId(),
      driverId: tip.driverId,
      presetId: null,
      message: null,
      tipId: tip.id,
      createdAt: new Date().toISOString(),
    });

    const stats = await getDriverStats(tip.driverId);
    await awardMilestones(tip.driverId, stats.total.thanks, stats.streakDays);
  }

  if (event.type === "checkout.session.expired") {
    const tipId = event.data.object.metadata?.tipId;
    if (tipId) {
      const tip = await store.getTipById(tipId);
      if (tip?.paymentStatus === "pending") {
        await store.updateTip(tip.id, { paymentStatus: "failed" });
      }
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const paymentIntent =
      typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (paymentIntent) {
      const tips = await store.listTips();
      const tip = tips.find((t) => t.providerPaymentId === paymentIntent);
      if (tip) await store.updateTip(tip.id, { paymentStatus: "refunded" });
    }
  }

  if (event.type === "account.updated") {
    const account = event.data.object;
    const driverId = account.metadata?.driverId;
    if (driverId) {
      await store.updateDriverProfile(driverId, {
        payoutReady: Boolean(account.payouts_enabled && account.details_submitted),
      });
    }
  }

  return NextResponse.json({ received: true });
}
