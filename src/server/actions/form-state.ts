import "server-only";
import { unstable_rethrow } from "next/navigation";
import { isServiceError } from "../errors";
import { errorMessage, logEvent } from "../events";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  saved?: boolean;
  /** Nur im Testmodus ohne Mailversand: Link zum direkten Weiterklicken. */
  devLink?: string;
};

/**
 * Führt eine Aktion aus und übersetzt Fehler in Formularzustand.
 * Weiterleitungen (redirect) werden unverändert durchgereicht.
 */
export async function formAction(run: () => Promise<FormState | void>): Promise<FormState> {
  try {
    return (await run()) ?? { saved: true };
  } catch (error) {
    unstable_rethrow(error);
    if (isServiceError(error)) {
      return error.field ? { fieldErrors: { [error.field]: error.message } } : { error: error.message };
    }
    await logEvent("error", "action", "Unerwarteter Fehler", { error: errorMessage(error) });
    return { error: "Da ist etwas schiefgegangen. Bitte versuch es noch einmal." };
  }
}

export function formBoolean(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

export function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
