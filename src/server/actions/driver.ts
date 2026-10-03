"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDriver } from "../guards";
import { destroySession } from "../session";
import { enforceRateLimit, enforceRateLimitFor } from "../rate-limit";
import { ServiceError } from "../errors";
import { parseInput } from "../services/auth";
import {
  deleteAccount,
  profileSchema,
  removeDriverPhoto,
  requestBadge,
  setPhotoPublic,
  setDriverActive,
  updateDriverProfile,
  uploadDriverPhoto,
} from "../services/profile";
import { cancelCardOrder, cardDesignSchema, cardOrderSchema, createCardOrder, saveCardDesign } from "../services/cards";
import { concludeTippingContract, refreshPayoutReadiness, startPayoutOnboarding } from "../services/payouts";
import { formAction, formBoolean, formString, type FormState } from "./form-state";

function refreshDashboard() {
  revalidatePath("/dashboard", "layout");
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    const { user, driver } = await requireDriver();
    const input = parseInput(profileSchema, {
      firstName: formString(formData, "firstName"),
      lastName: formString(formData, "lastName"),
      nameDisplay: formString(formData, "nameDisplay"),
      customName: formString(formData, "customName"),
      // V1: Lieferdienstfelder behalten, obwohl sie nicht mehr im Formular stehen.
      providerId: "",
      providerPublic: driver.providerPublic,
      tagline: formString(formData, "tagline"),
      bio: formString(formData, "bio"),
      city: formString(formData, "city"),
      phone: formString(formData, "phone"),
      notifyOnTip: formBoolean(formData, "notifyOnTip"),
    });
    await updateDriverProfile(user, driver, { ...input, providerId: driver.providerId, providerPublic: driver.providerPublic });
    refreshDashboard();
    return { saved: true };
  });
}

export async function uploadPhotoAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    const { driver } = await requireDriver();
    await enforceRateLimit("photo", 10, 10 * 60_000);
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) {
      throw new ServiceError("photo_missing", "Bitte wähle ein Foto aus.", 400, "photo");
    }
    await uploadDriverPhoto(driver, new Uint8Array(await file.arrayBuffer()));
    refreshDashboard();
    return { saved: true };
  });
}

export async function removePhotoAction(): Promise<void> {
  const { driver } = await requireDriver();
  await removeDriverPhoto(driver);
  refreshDashboard();
}

export async function setPhotoPublicAction(photoPublic: boolean): Promise<void> {
  const { driver } = await requireDriver();
  await setPhotoPublic(driver, photoPublic);
  refreshDashboard();
}

export async function setActiveAction(active: boolean): Promise<void> {
  const { driver } = await requireDriver();
  await setDriverActive(driver, active);
  refreshDashboard();
}

export async function requestBadgeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    const { user, driver } = await requireDriver();
    await requestBadge(user, driver, formString(formData, "documentNote"));
    refreshDashboard();
    return { saved: true };
  });
}

export async function saveCardDesignAction(input: {
  layout: string;
  headline: string;
  showPhoto: boolean;
  showProvider: boolean;
}): Promise<FormState> {
  return formAction(async () => {
    const { driver } = await requireDriver();
    await saveCardDesign(driver.id, parseInput(cardDesignSchema, input));
    refreshDashboard();
    return { saved: true };
  });
}

export async function createCardOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    const { user, driver } = await requireDriver();
    await enforceRateLimit("card-order", 5, 60 * 60_000);
    const { paymentUrl } = await createCardOrder(user, driver, parseInput(cardOrderSchema, Object.fromEntries(formData)));
    refreshDashboard();
    redirect(paymentUrl ?? "/dashboard/karte/bestellen?bestellt=1");
  });
}

export async function cancelCardOrderAction(orderId: string): Promise<FormState> {
  return formAction(async () => {
    const { driver } = await requireDriver();
    await cancelCardOrder(driver.id, orderId);
    refreshDashboard();
  });
}

export async function startPayoutOnboardingAction(consent: { immediateStart: boolean } = { immediateStart: false }): Promise<FormState> {
  let url: string;
  const state = await formAction(async () => {
    const { user, driver } = await requireDriver();
    // Jeder Klick spricht die Stripe-API an – pro Konto begrenzt.
    enforceRateLimitFor(`payout-start:${user.id}`, 10, 10 * 60_000);
    await concludeTippingContract(user, driver, { immediateStart: consent?.immediateStart === true });
    url = await startPayoutOnboarding(user, driver);
  });
  if (state.error) return state;
  redirect(url!);
}

export async function refreshPayoutStatusAction(): Promise<FormState> {
  return formAction(async () => {
    const { user, driver } = await requireDriver();
    enforceRateLimitFor(`payout-refresh:${user.id}`, 20, 10 * 60_000);
    await refreshPayoutReadiness(driver);
    refreshDashboard();
  });
}

export async function deleteDriverAccountAction(): Promise<void> {
  const { user } = await requireDriver();
  await deleteAccount(user);
  await destroySession();
  redirect("/?geloescht=1");
}
