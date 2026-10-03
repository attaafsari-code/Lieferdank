"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, getSession } from "../session";
import { enforceRateLimit, enforceRateLimitFor } from "../rate-limit";
import { safeRedirectPath } from "../guards";
import {
  authenticate,
  completePasswordReset,
  confirmEmail,
  customerRegistrationSchema,
  driverRegistrationSchema,
  homePathFor,
  loginSchema,
  parseInput,
  registerCustomer,
  registerDriver,
  requestEmailVerification,
  requestPasswordReset,
  localMailLink,
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
    const credentials = parseInput(loginSchema, Object.fromEntries(formData));
    // Zusätzlich pro Konto: verteiltes Durchprobieren von Passwörtern über viele IP-Adressen bremsen.
    enforceRateLimitFor(`login-email:${credentials.email}`, 20, 15 * 60_000);
    const user = await authenticate(credentials);
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
    // Pro Adresse begrenzt: niemand soll ein fremdes Postfach mit Reset-Mails fluten können.
    enforceRateLimitFor(`reset-email:${email.toLowerCase()}`, 3, 60 * 60_000);
    const { link } = await requestPasswordReset(email);
    // Immer dieselbe Antwort – verrät nicht, ob es das Konto gibt.
    return { saved: true, devLink: localMailLink(link) };
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

/** Bestätigungslink erneut senden – nur für das eigene, angemeldete Konto. */
export async function resendVerificationAction(): Promise<FormState> {
  return formAction(async () => {
    const session = await getSession();
    if (!session) throw new ServiceError("unauthenticated", "Bitte melde dich zuerst an.", 401);
    await enforceRateLimit("verify-resend", 10, 60 * 60_000);
    enforceRateLimitFor(`verify-resend-user:${session.user.id}`, 3, 60 * 60_000);
    const { link } = await requestEmailVerification(session.user);
    return { saved: true, devLink: localMailLink(link) };
  });
}

/** Bestätigt per Klick auf der Seite – nicht schon beim Öffnen, damit Link-Scanner nichts bestätigen. */
export async function confirmEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("verify-confirm", 20, 15 * 60_000);
    await confirmEmail(formString(formData, "token"));
    return { saved: true };
  });
}
