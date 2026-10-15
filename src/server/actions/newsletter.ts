"use server";

import { enforceRateLimit } from "../rate-limit";
import { confirmNewsletter, requestNewsletter, revokeNewsletter, revokeNewsletterLink } from "../services/newsletter";
import { getSession } from "../session";
import { ServiceError } from "../errors";
import { revalidatePath } from "next/cache";
import { formAction, formString, type FormState } from "./form-state";

export async function confirmNewsletterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("newsletter-confirm", 20, 15 * 60_000);
    await confirmNewsletter(formString(formData, "token"));
    return { saved: true };
  });
}
export async function unsubscribeNewsletterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("newsletter-unsubscribe", 20, 900000);
    await revokeNewsletterLink(formString(formData, "token")); return { saved: true };
  });
}

export async function newsletterAction(_prev: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("newsletter-account", 5, 3600000);
    const session = await getSession();
    if (!session) throw new ServiceError("unauthorized", "Bitte melde dich an.", 401);
    if (form.get("mode") === "revoke") await revokeNewsletter(session.user);
    else {
      if (form.get("consent") !== "on") throw new ServiceError("consent_required", "Bitte bestätige deine freiwillige Anmeldung.", 400);
      const result = await requestNewsletter(session.user, "web");
      if (result.status !== "confirmed" && !result.mailSent) throw new ServiceError("mail_unavailable", "Die Bestätigungs-E-Mail konnte nicht verschickt werden. Bitte versuche es später erneut.", 503);
    }
    revalidatePath("/konto"); revalidatePath("/dashboard/profil");
    return { saved: true };
  });
}
