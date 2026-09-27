import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import type { User } from "@/lib/db/types";
import { newId } from "@/lib/id";
import { ServiceError } from "../errors";
import { hashPassword, verifyPassword } from "../session";
import { mailConfigured, sendMail } from "../mail";
import { emails } from "../emails";
import { baseUrl } from "../site";
import { createDriverProfile } from "./drivers";
import { addFavoriteByCode } from "./favorites";

/* ---------- Validierung (gemeinsam für Formulare und API) ---------- */

const email = z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse an.").max(200);
const password = z.string().min(8, "Mindestens 8 Zeichen.").max(200);
const name = (label: string) => z.string().trim().min(1, `Bitte gib deinen ${label} an.`).max(60);

export const driverRegistrationSchema = z.object({
  firstName: name("Vornamen"),
  lastName: name("Nachnamen"),
  email,
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  password,
  terms: z.literal("on", { errorMap: () => ({ message: "Bitte bestätige die Hinweise." }) }),
});

export const customerRegistrationSchema = z.object({
  firstName: z.string().trim().max(60).optional().or(z.literal("")),
  email,
  password,
  terms: z.literal("on", { errorMap: () => ({ message: "Bitte bestätige die Hinweise." }) }),
  saveCode: z.string().trim().max(20).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Bitte gib dein Passwort ein."),
});

/** Übersetzt Zod-Fehler in einen ServiceError mit Feldzuordnung. */
export function parseInput<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  throw new ServiceError("invalid_input", issue.message, 400, String(issue.path[0] ?? "form"));
}

async function assertEmailFree(address: string): Promise<void> {
  if (await getDb().users.findOne({ email: address })) {
    throw new ServiceError("email_taken", "Für diese E-Mail gibt es bereits ein Konto.", 409, "email");
  }
}

/* ---------- Registrierung ---------- */

export async function registerDriver(input: z.infer<typeof driverRegistrationSchema>): Promise<User> {
  await assertEmailFree(input.email);
  const now = new Date().toISOString();
  const db = getDb();

  const user = await db.users.insert({
    id: newId(),
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone || null,
    role: "driver",
    passwordHash: await hashPassword(input.password),
    tokenVersion: 0,
    createdAt: now,
    blockedAt: null,
    blockedReason: null,
  });

  let driver;
  try {
    driver = await createDriverProfile(user.id, now);
    await db.verifications.insert({
      id: newId(),
      userId: user.id,
      identityStatus: "unverified",
      driverStatus: "unverified",
      documentNote: null,
      reviewNote: null,
      updatedAt: now,
    });
  } catch (error) {
    await db.users.remove(user.id).catch(() => undefined);
    throw error;
  }

  await sendMail(user.email, emails.welcomeDriver(user.firstName, driver.code, `${baseUrl()}/dashboard`), "welcome_driver");
  return user;
}

export async function registerCustomer(input: z.infer<typeof customerRegistrationSchema>): Promise<User> {
  await assertEmailFree(input.email);
  const now = new Date().toISOString();
  const db = getDb();

  const user = await db.users.insert({
    id: newId(),
    email: input.email,
    firstName: input.firstName || "",
    lastName: "",
    phone: null,
    role: "customer",
    passwordHash: await hashPassword(input.password),
    tokenVersion: 0,
    createdAt: now,
    blockedAt: null,
    blockedReason: null,
  });
  try {
    await db.customerProfiles.insert({ id: newId(), userId: user.id, createdAt: now });
  } catch (error) {
    await db.users.remove(user.id).catch(() => undefined);
    throw error;
  }

  // „Lieferant speichern“ vor der Registrierung: direkt nachholen.
  if (input.saveCode) {
    await addFavoriteByCode(user.id, input.saveCode).catch(() => undefined);
  }

  await sendMail(user.email, emails.welcomeCustomer(user.firstName, `${baseUrl()}/konto`), "welcome_customer");
  return user;
}

/* ---------- Anmeldung ---------- */

export async function authenticate(input: z.infer<typeof loginSchema>): Promise<User> {
  const user = await getDb().users.findOne({ email: input.email });
  // Immer dieselbe Meldung: verrät nicht, ob die Adresse existiert.
  const invalid = new ServiceError("invalid_credentials", "E-Mail oder Passwort ist falsch.", 401);
  if (!user) {
    // Gleiche Rechenzeit wie bei einem echten Vergleich – kein Timing-Leck.
    await hashPassword(input.password);
    throw invalid;
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) throw invalid;
  if (user.blockedAt) {
    throw new ServiceError("blocked", "Dieses Konto ist gesperrt. Bitte wende dich an den Support.", 403);
  }
  return user;
}

export function homePathFor(user: Pick<User, "role">): string {
  if (user.role === "admin") return "/admin";
  if (user.role === "customer") return "/konto";
  return "/dashboard";
}

/* ---------- Passwort vergessen ---------- */

const RESET_TTL_MINUTES = 60;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Gibt den Link zurück, damit er ohne Mailversand im Testmodus angezeigt werden kann. */
export async function requestPasswordReset(address: string): Promise<{ link: string | null }> {
  if (process.env.NODE_ENV === "production" && !mailConfigured()) {
    throw new ServiceError("mail_unavailable", "Passwort-Zurücksetzen ist gerade nicht verfügbar. Bitte versuche es später erneut.", 503);
  }
  const db = getDb();
  const user = await db.users.findOne({ email: address.trim().toLowerCase() });
  if (!user || user.blockedAt) return { link: null };

  const open = await db.passwordResets.findMany({ where: { userId: user.id, usedAt: null } });
  const now = new Date().toISOString();
  for (const reset of open) await db.passwordResets.update(reset.id, { usedAt: now });

  const token = randomBytes(32).toString("base64url");
  await db.passwordResets.insert({
    id: newId(),
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString(),
    usedAt: null,
    createdAt: now,
  });

  const link = `${baseUrl()}/passwort-neu?token=${token}`;
  await sendMail(user.email, emails.passwordReset(user.firstName || "du", link, RESET_TTL_MINUTES), "password_reset");
  return { link };
}

export async function completePasswordReset(token: string, newPassword: string): Promise<User> {
  const db = getDb();
  const invalid = new ServiceError("reset_invalid", "Dieser Link ist nicht mehr gültig. Fordere bitte einen neuen an.", 400);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalid;
  const reset = await db.passwordResets.findOne({ tokenHash: hashToken(token) });
  if (!reset || reset.usedAt || new Date(reset.expiresAt).getTime() < Date.now()) throw invalid;

  const user = await db.users.get(reset.userId);
  if (!user || user.blockedAt) throw invalid;

  if (!await db.passwordResets.updateIf(reset.id, { usedAt: null }, { usedAt: new Date().toISOString() })) throw invalid;
  const tokenVersion = (user.tokenVersion ?? 0) + 1;
  await db.users.update(user.id, { passwordHash: await hashPassword(newPassword), tokenVersion });
  return { ...user, tokenVersion };
}
