"use server";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { generateLieferdankCode, newId } from "@/lib/id";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { mailConfigured, sendMail } from "@/lib/mail";
import { baseUrl } from "@/lib/site";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Signalisiert dem Formular eine erfolgreiche Speicherung. */
  saved?: boolean;
};

const registerSchema = z.object({
  name: z.string().trim().min(2, "Bitte gib deinen Namen an.").max(80),
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse an."),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  password: z.string().min(8, "Mindestens 8 Zeichen.").max(200),
  terms: z.literal("on", { errorMap: () => ({ message: "Bitte bestätige die Hinweise." }) }),
});

/** Erzeugt einen garantiert freien Lieferdank-Code. */
async function uniqueCode(): Promise<string> {
  const store = getStore();
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateLieferdankCode(attempt < 8 ? 5 : 6);
    if (!(await store.getDriverByCode(code))) return code;
  }
  throw new Error("Es konnte kein freier Lieferdank-Code erzeugt werden.");
}

export async function registerDriver(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!rateLimit(await clientKey("register"), 5, 10 * 60_000)) {
    return { error: "Zu viele Registrierungsversuche. Bitte später erneut versuchen." };
  }

  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const { name, email, phone, password } = parsed.data;
  const store = getStore();

  if (await store.getUserByEmail(email)) {
    return { fieldErrors: { email: "Für diese E-Mail gibt es bereits ein Konto." } };
  }

  const now = new Date().toISOString();
  const user = await store.createUser({
    id: newId(),
    name,
    email,
    phone: phone || null,
    role: "driver",
    passwordHash: await hashPassword(password),
    createdAt: now,
    blockedAt: null,
    blockedReason: null,
    tokenVersion: 0,
  });

  await store.createDriverProfile({
    id: newId(),
    userId: user.id,
    displayName: name.split(" ")[0],
    code: await uniqueCode(),
    providerId: null,
    providerVerified: false,
    verification: "unverified",
    active: true,
    city: null,
    payoutAccountId: null,
    payoutReady: false,
    createdAt: now,
  });

  await store.upsertVerification({
    id: newId(),
    userId: user.id,
    identityStatus: "unverified",
    driverStatus: "unverified",
    documentNote: null,
    reviewNote: null,
    updatedAt: now,
  });

  await createSession(user.id, user.tokenVersion);
  redirect("/dashboard?willkommen=1");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse an."),
  password: z.string().min(1, "Bitte gib dein Passwort ein."),
});

export async function loginUser(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!rateLimit(await clientKey("login"), 10, 10 * 60_000)) {
    return { error: "Zu viele Anmeldeversuche. Bitte später erneut versuchen." };
  }

  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Bitte prüfe deine Eingaben." };

  const user = await getStore().getUserByEmail(parsed.data.email);
  // Immer dieselbe Meldung: verraet nicht, ob die E-Mail existiert.
  const invalid: FormState = { error: "E-Mail oder Passwort ist falsch." };
  if (!user) return invalid;
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid;
  if (user.blockedAt) {
    return { error: "Dieses Konto ist gesperrt. Bitte wende dich an den Support." };
  }

  await createSession(user.id, user.tokenVersion);
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}


/* -------------------------------------------------------------------------
   Passwort vergessen
   ------------------------------------------------------------------------- */

const RESET_TTL_MINUTES = 60;

/** Nur der Hash landet in der Datenbank -- ein Leck gibt keine gueltigen Links her. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type ResetRequestState = FormState & {
  sent?: boolean;
  /** Nur ohne konfigurierten Mailversand: Link zum direkten Testen. */
  devLink?: string;
};

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse an."),
});

export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  if (!rateLimit(await clientKey("reset-request"), 5, 15 * 60_000)) {
    return { error: "Zu viele Anfragen. Bitte später erneut versuchen." };
  }

  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.issues[0].message } };
  }

  const store = getStore();
  const user = await store.getUserByEmail(parsed.data.email);

  // Immer dieselbe Antwort: Die Seite verraet nicht, welche Adressen existieren.
  if (!user || user.blockedAt) return { sent: true };

  await store.invalidatePasswordResets(user.id);

  const token = randomBytes(32).toString("base64url");
  await store.createPasswordReset({
    id: newId(),
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString(),
    usedAt: null,
    createdAt: new Date().toISOString(),
  });

  const link = `${baseUrl()}/passwort-neu?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Neues Passwort für Lieferdank",
    text:
      `Hallo ${user.name},\n\n` +
      `du kannst hier ein neues Passwort setzen:\n${link}\n\n` +
      `Der Link gilt ${RESET_TTL_MINUTES} Minuten. Wenn du das nicht warst, ` +
      `ignoriere diese E-Mail einfach – dein Passwort bleibt unverändert.\n\n` +
      `Dein Lieferdank-Team`,
  });

  return { sent: true, devLink: mailConfigured() ? undefined : link };
}

const newPasswordSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(8, "Mindestens 8 Zeichen.").max(200),
    passwordRepeat: z.string(),
  })
  .refine((data) => data.password === data.passwordRepeat, {
    path: ["passwordRepeat"],
    message: "Die Passwörter stimmen nicht überein.",
  });

export async function completePasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!rateLimit(await clientKey("reset-complete"), 10, 15 * 60_000)) {
    return { error: "Zu viele Versuche. Bitte später erneut versuchen." };
  }

  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { fieldErrors };
  }

  const store = getStore();
  const reset = await store.getPasswordResetByTokenHash(hashToken(parsed.data.token));

  const invalid: FormState = {
    error: "Dieser Link ist nicht mehr gültig. Fordere bitte einen neuen an.",
  };
  if (!reset || reset.usedAt) return invalid;
  if (new Date(reset.expiresAt).getTime() < Date.now()) return invalid;

  // Konstante Laufzeit beim Vergleich, auch wenn der Hash bereits gefunden wurde.
  const expected = Buffer.from(reset.tokenHash);
  const actual = Buffer.from(hashToken(parsed.data.token));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return invalid;

  const user = await store.getUserById(reset.userId);
  if (!user || user.blockedAt) return invalid;

  await store.updateUser(user.id, {
    passwordHash: await hashPassword(parsed.data.password),
    // Erhoehte Version wirft alle bestehenden Sessions raus.
    tokenVersion: (user.tokenVersion ?? 0) + 1,
  });
  await store.markPasswordResetUsed(reset.id);

  await createSession(user.id, (user.tokenVersion ?? 0) + 1);
  redirect(user.role === "admin" ? "/admin" : "/dashboard");
}
