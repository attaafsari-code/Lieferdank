"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../guards";
import { logAdminAction, regenerateCode, reviewBadge, setProviderVerified, setUserBlocked } from "../services/admin";
import { updateCardOrderStatus } from "../services/cards";
import { formAction, type FormState } from "./form-state";
import type { CardOrderStatus } from "@/lib/db/types";
import { ServiceError } from "../errors";

/** Jede Adminaktion prüft die Rolle selbst – das Layout allein schützt keine Server Action. */

function refresh() {
  revalidatePath("/admin", "layout");
}

export async function reviewBadgeAction(driverId: string, decision: "verified" | "rejected", note: string): Promise<FormState> {
  return formAction(async () => {
    const { user } = await requireAdmin();
    await reviewBadge(user, driverId, decision, note);
    refresh();
  });
}

export async function setProviderVerifiedAction(driverId: string, verified: boolean): Promise<FormState> {
  return formAction(async () => {
    const { user } = await requireAdmin();
    await setProviderVerified(user, driverId, verified);
    refresh();
  });
}

export async function setUserBlockedAction(userId: string, blocked: boolean, reason: string): Promise<FormState> {
  return formAction(async () => {
    const { user } = await requireAdmin();
    await setUserBlocked(user, userId, blocked, reason);
    refresh();
  });
}

export async function regenerateCodeAction(driverId: string, reason: string): Promise<FormState> {
  return formAction(async () => {
    const { user } = await requireAdmin();
    await regenerateCode(user, driverId, reason);
    refresh();
  });
}

export async function updateCardOrderAction(
  orderId: string,
  status: CardOrderStatus,
  carrier: string,
  trackingNumber: string,
  reason: string,
): Promise<FormState> {
  return formAction(async () => {
    const { user } = await requireAdmin();
    if (!reason.trim()) throw new ServiceError("reason_required", "Bitte einen Grund für die Statusänderung angeben.", 400);
    // Vor der finanziell relevanten Änderung protokollieren: scheitert das
    // Audit-Log, darf auch der Kartenstatus nicht verändert werden.
    await logAdminAction(user, orderId, "card_order_status_requested", `${status}: ${reason.trim().slice(0, 250)}`);
    await updateCardOrderStatus(orderId, status, { carrier, trackingNumber });
    refresh();
  });
}
