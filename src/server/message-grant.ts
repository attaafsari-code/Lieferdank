import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { purposeKey } from "./session";

/**
 * Schreibrecht für die optionale Nachricht zu einem Danke.
 *
 * Nur wer das Danke bzw. die Zahlung selbst ausgelöst hat, bekommt es: im Web als signiertes,
 * httpOnly-Cookie, in der App als Token aus der Antwort. Wer nur eine Danke- oder Zahlungs-ID
 * kennt (geteilter Link, Datenexport, Stripe-Metadaten), kann damit nichts schreiben.
 */

export const MESSAGE_GRANT_COOKIE = "ld_message_grant";
const PURPOSE = "thank_you_message";
const TTL_SECONDS = 24 * 60 * 60;
/** Die letzten Vorgänge eines Browsers – z. B. kostenloses Danke und danach Trinkgeld. */
const MAX_SUBJECTS = 5;

/** Gegenstand des Schreibrechts: ein Danke („t:“) oder die Zahlung, aus der es entsteht („p:“). */
export const thankYouSubject = (thankYouId: string) => `t:${thankYouId}`;
export const paymentSubject = (paymentId: string) => `p:${paymentId}`;

export async function signMessageGrant(subjects: string[]): Promise<string> {
  return new SignJWT({ typ: PURPOSE, subs: subjects })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(purposeKey(PURPOSE));
}

/** Die Gegenstände eines gültigen Schreibrechts – bei allem anderen eine leere Liste. */
export async function readMessageGrant(token: string | null | undefined): Promise<string[]> {
  if (!token || token.length > 4096) return [];
  try {
    const { payload } = await jwtVerify(token, purposeKey(PURPOSE));
    if (payload.typ !== PURPOSE || !Array.isArray(payload.subs)) return [];
    return payload.subs.filter((subject): subject is string => typeof subject === "string");
  } catch {
    return [];
  }
}

/** Web: Schreibrecht für einen neuen Vorgang ins Cookie aufnehmen. */
export async function grantMessage(subject: string): Promise<void> {
  const jar = await cookies();
  const existing = await readMessageGrant(jar.get(MESSAGE_GRANT_COOKIE)?.value);
  const subjects = [...existing.filter((known) => known !== subject), subject].slice(-MAX_SUBJECTS);
  jar.set(MESSAGE_GRANT_COOKIE, await signMessageGrant(subjects), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

/** Web: die Schreibrechte dieses Browsers. */
export async function messageGrantsFromCookie(): Promise<string[]> {
  return readMessageGrant((await cookies()).get(MESSAGE_GRANT_COOKIE)?.value);
}
