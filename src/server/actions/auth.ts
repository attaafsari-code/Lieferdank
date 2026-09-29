"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "../session";
import { enforceRateLimit } from "../rate-limit";
import { safeRedirectPath } from "../guards";
import {
  authenticate,
  completePasswordReset,
  customerRegistrationSchema,
  driverRegistrationSchema,
  homePathFor,
  loginSchema,
  parseInput,
  registerCustomer,
  registerDriver,
  requestPasswordReset,
  localResetLink,
} from "../services/auth";
import { addFavoriteByCode } from "../services/favorites";
import { formAction, formString, type FormState } from "./form-state";
import { ServiceError } from "../errors";

export async function registerDriverAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("register", 5, 10 * 60_000);
    const input = parseInput(driverRegistrationSchema, Object.fromEntries(formData));
    const user = await registerDriver(input);
    await createSession(user);
    redirect("/dashboard?willkommen=1");
  });
}

export async function registerCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("register", 5, 10 * 60_000);
    const input = parseInput(customerRegistrationSchema, Object.fromEntries(formData));
    const user = await registerCustomer(input);
    await createSession(user);
    redirect(input.saveCode ? "/konto?gespeichert=1" : "/konto?willkommen=1");
  });
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("login", 10, 10 * 60_000);
    const user = await authenticate(parseInput(loginSchema, Object.fromEntries(formData)));
    await createSession(user);

    // „Lieferant speichern“ nach der Anmeldung nachholen.
    const saveCode = formString(formData, "saveCode");
    if (saveCode && user.role === "customer") {
      await addFavoriteByCode(user.id, saveCode).catch(() => undefined);
      redirect("/konto?gespeichert=1");
    }
    redirect(safeRedirectPath(formString(formData, "weiter"), homePathFor(user)));
  });
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function requestResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("reset-request", 5, 15 * 60_000);
    const email = formString(formData, "email").trim();
    if (!email.includes("@")) throw new ServiceError("invalid_email", "Bitte gib eine gültige E-Mail-Adresse an.", 400, "email");
    const { link } = await requestPasswordReset(email);
    // Immer dieselbe Antwort – verrät nicht, ob es das Konto gibt.
    return { saved: true, devLink: localResetLink(link) };
  });
}

export async function completeResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("reset-complete", 10, 15 * 60_000);
    const password = formString(formData, "password");
    if (password.length < 8) throw new ServiceError("short", "Mindestens 8 Zeichen.", 400, "password");
    if (password !== formString(formData, "passwordRepeat")) {
      throw new ServiceError("mismatch", "Die Passwörter stimmen nicht überein.", 400, "passwordRepeat");
    }
    const user = await completePasswordReset(formString(formData, "token"), password);
    await createSession(user);
    redirect(homePathFor(user));
  });
}
