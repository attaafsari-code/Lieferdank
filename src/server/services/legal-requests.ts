import "server-only";
import { z } from "zod";
import { OPERATOR, TIPPING_SERVICE_NAME } from "@/lib/legal-content";
import { isProductionRuntime } from "@/lib/runtime";
import { ServiceError } from "../errors";
import { emails } from "../emails";
import { errorMessage, logEvent } from "../events";
import { sendMail } from "../mail";
import { enforceRateLimitFor } from "../rate-limit";

/**
 * Formulare mit rechtlicher Funktion. Jede Eingabe geht als E-Mail an das Lieferdank-Postfach;
 * die absendende Person erhält eine Eingangsbestätigung mit Datum und Uhrzeit.
 *
 * - kontakt:     zweiter schneller Kontaktweg neben der E-Mail (§ 5 Abs. 1 Nr. 2 DDG) und
 *                zentrale Kontaktstelle (Art. 11, 12 DSA)
 * - meldung:     Melde- und Abhilfeverfahren für rechtswidrige Inhalte (Art. 16 DSA)
 * - widerruf:    Online-Widerrufsfunktion (§ 356a BGB)
 * - kuendigung:  Kündigungsschaltfläche (§ 312k BGB)
 *
 * Bestätigungen enthalten nur die strukturierten Angaben, keine freien Texte der absendenden
 * Person – sonst ließe sich das Formular nutzen, um beliebige Nachrichten an Dritte zu schicken.
 */

const email = z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse an.").max(200);
const text = (min: number, max: number, message: string) => z.string().trim().min(min, message).max(max, `Höchstens ${max} Zeichen.`);
const singleLine = (min: number, max: number, message: string) =>
  text(min, max, message).refine((value) => !/[\r\n]/.test(value), "Bitte ohne Zeilenumbruch.");

export const CONTRACTS = {
  konto: "Lieferdank-Konto (gesamte Nutzung)",
  trinkgeld: `Nur die ${TIPPING_SERVICE_NAME}`,
} as const;

const schemas = {
  kontakt: z.object({
    name: singleLine(0, 100, "").optional().or(z.literal("")),
    email,
    message: text(10, 4000, "Bitte beschreibe dein Anliegen (mindestens 10 Zeichen)."),
  }),
  meldung: z.object({
    name: singleLine(1, 100, "Bitte gib deinen Namen an."),
    email,
    location: singleLine(3, 500, "Bitte gib an, wo der Inhalt steht (z. B. Adresse der Danke-Seite oder Danke-Code)."),
    reason: text(20, 4000, "Bitte begründe, warum der Inhalt rechtswidrig ist (mindestens 20 Zeichen)."),
    goodFaith: z.literal("on", { errorMap: () => ({ message: "Bitte bestätige, dass deine Angaben richtig und vollständig sind." }) }),
  }),
  widerruf: z.object({
    name: singleLine(1, 100, "Bitte gib deinen Namen an."),
    contract: singleLine(3, 200, "Bitte gib die E-Mail-Adresse deines Lieferdank-Kontos oder deinen Danke-Code an."),
    email,
  }),
  kuendigung: z.object({
    type: z.enum(["ordentlich", "ausserordentlich"], { errorMap: () => ({ message: "Bitte wähle die Art der Kündigung." }) }),
    reason: text(0, 1000, "").optional().or(z.literal("")),
    contract: z.enum(["konto", "trinkgeld"], { errorMap: () => ({ message: "Bitte wähle den Vertrag." }) }),
    name: singleLine(1, 100, "Bitte gib deinen Namen an."),
    account: singleLine(3, 200, "Bitte gib die E-Mail-Adresse deines Lieferdank-Kontos oder deinen Danke-Code an."),
    date: z.string().trim().regex(/^(|\d{4}-\d{2}-\d{2})$/, "Bitte ein gültiges Datum wählen.").optional(),
    email,
  }).refine((data) => data.type !== "ausserordentlich" || Boolean(data.reason?.trim()), {
    path: ["reason"],
    message: "Bitte gib bei einer außerordentlichen Kündigung den Grund an.",
  }),
} as const;

export type LegalRequestKind = keyof typeof schemas;
export type LegalRequestInput<K extends LegalRequestKind> = z.infer<(typeof schemas)[K]>;

export function parseLegalRequest<K extends LegalRequestKind>(kind: K, raw: unknown): LegalRequestInput<K> {
  const parsed = schemas[kind].safeParse(raw);
  if (parsed.success) return parsed.data as LegalRequestInput<K>;
  const issue = parsed.error.issues[0];
  throw new ServiceError("invalid_input", issue.message, 400, String(issue.path[0] ?? "form"));
}

/** Datum und Uhrzeit für Bestätigungen, deutsche Zeit. */
export function formatReceivedAt(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(date) + " Uhr";
}

type Prepared = { operatorSubject: string; operatorLines: string[]; receiptSubject: string; receiptIntro: string; receiptLines: string[] };

function prepare<K extends LegalRequestKind>(kind: K, input: LegalRequestInput<K>): Prepared {
  switch (kind) {
    case "kontakt": {
      const data = input as LegalRequestInput<"kontakt">;
      return {
        operatorSubject: "Kontaktanfrage über lieferdank.de",
        operatorLines: [`Name: ${data.name || "–"}`, `E-Mail: ${data.email}`, "Nachricht:", data.message],
        receiptSubject: "Deine Nachricht an Lieferdank",
        receiptIntro: "Danke! Wir haben deine Nachricht erhalten und antworten dir per E-Mail.",
        receiptLines: [],
      };
    }
    case "meldung": {
      const data = input as LegalRequestInput<"meldung">;
      return {
        operatorSubject: "Meldung eines Inhalts (Art. 16 DSA)",
        operatorLines: [
          `Name: ${data.name}`, `E-Mail: ${data.email}`, `Fundstelle: ${data.location}`, "Begründung:", data.reason,
          "Die meldende Person hat bestätigt, dass ihre Angaben nach bestem Wissen richtig und vollständig sind.",
        ],
        receiptSubject: "Eingangsbestätigung deiner Meldung",
        receiptIntro: "Wir haben deine Meldung erhalten, prüfen sie und teilen dir unsere Entscheidung per E-Mail mit.",
        receiptLines: [`Gemeldete Fundstelle: ${data.location}`],
      };
    }
    case "widerruf": {
      const data = input as LegalRequestInput<"widerruf">;
      const lines = [
        `Erklärung: Ich widerrufe den von mir abgeschlossenen Vertrag über die Lieferdank-${TIPPING_SERVICE_NAME}.`,
        `Name: ${data.name}`, `Vertrag/Konto: ${data.contract}`, `Bestätigung an: ${data.email}`,
      ];
      return {
        operatorSubject: `Widerruf: Lieferdank-${TIPPING_SERVICE_NAME}`,
        operatorLines: lines,
        receiptSubject: "Eingangsbestätigung deines Widerrufs",
        receiptIntro: "Wir haben deinen Widerruf erhalten. Inhalt deiner Widerrufserklärung:",
        receiptLines: lines,
      };
    }
    case "kuendigung": {
      const data = input as LegalRequestInput<"kuendigung">;
      const when = data.date ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin" }).format(new Date(`${data.date}T12:00:00Z`)) : "zum frühestmöglichen Zeitpunkt";
      const lines = [
        `Art der Kündigung: ${data.type === "ordentlich" ? "ordentliche Kündigung" : "außerordentliche Kündigung"}`,
        ...(data.type === "ausserordentlich" ? [`Kündigungsgrund: ${data.reason}`] : []),
        `Vertrag: ${CONTRACTS[data.contract]}`,
        `Name: ${data.name}`, `Konto: ${data.account}`, `Beenden zum: ${when}`, `Bestätigung an: ${data.email}`,
      ];
      return {
        operatorSubject: "Kündigung über „Verträge hier kündigen“",
        operatorLines: lines,
        receiptSubject: "Eingangsbestätigung deiner Kündigung",
        receiptIntro: "Wir haben deine Kündigung erhalten. Inhalt deiner Kündigungserklärung:",
        receiptLines: lines,
      };
    }
  }
}

/**
 * Leitet ein Formular weiter und bestätigt den Eingang. Rate Limits je Adresse und je
 * E-Mail-Adresse verhindern, dass das Formular für Massenmails missbraucht wird.
 */
export async function submitLegalRequest<K extends LegalRequestKind>(
  kind: K,
  raw: unknown,
  clientIp: string,
  now = new Date(),
): Promise<{ receivedAt: string; lines: string[] }> {
  const input = parseLegalRequest(kind, raw);
  enforceRateLimitFor(`legal-${kind}:${clientIp}`, 5, 60 * 60_000);
  enforceRateLimitFor(`legal-${kind}-mail:${input.email}`, 3, 60 * 60_000);

  const receivedAt = formatReceivedAt(now);
  const prepared = prepare(kind, input);
  const forwarded = await sendMail(OPERATOR.email, emails.requestToOperator(prepared.operatorSubject, prepared.operatorLines, receivedAt), `legal_${kind}`);
  if (!forwarded.delivered && isProductionRuntime()) {
    throw new ServiceError("request_unavailable", `Das hat gerade nicht geklappt. Bitte schreib uns direkt an ${OPERATOR.email}.`, 503);
  }
  const receipt = await sendMail(input.email, emails.requestReceipt(prepared.receiptSubject, prepared.receiptIntro, prepared.receiptLines, receivedAt), `legal_${kind}_receipt`);
  if (!receipt.delivered && isProductionRuntime()) {
    await logEvent("warning", "legal", "Eingangsbestätigung nicht zugestellt", { kind }).catch((error) => console.error(errorMessage(error)));
  }
  return { receivedAt, lines: prepared.receiptLines };
}
