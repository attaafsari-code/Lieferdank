"use server";

import { enforceRateLimit } from "../rate-limit";
import { confirmNewsletter } from "../services/newsletter";
import { formAction, formString, type FormState } from "./form-state";

export async function confirmNewsletterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("newsletter-confirm", 20, 15 * 60_000);
    await confirmNewsletter(formString(formData, "token"));
    return { saved: true };
  });
}
