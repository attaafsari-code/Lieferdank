import "server-only";
import { redirect } from "next/navigation";
import { getSession, type Session } from "./session";

type DriverSession = Session & { driver: NonNullable<Session["driver"]> };
type CustomerSession = Session & { customer: NonNullable<Session["customer"]> };

export async function requireDriver(): Promise<DriverSession> {
  const session = await getSession();
  if (!session?.driver) redirect("/login");
  return session as DriverSession;
}

export async function requireCustomer(): Promise<CustomerSession> {
  const session = await getSession();
  if (!session?.customer) redirect("/login?weiter=/konto");
  return session as CustomerSession;
}

export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (session?.user.role !== "admin") redirect("/login");
  return session;
}

/** Nur relative Pfade innerhalb der App – verhindert offene Weiterleitungen. */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
