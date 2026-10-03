"use server";

import { headers } from "next/headers";
import { ipFromHeaders } from "../rate-limit";
import { formatReceivedAt, submitLegalRequest, type LegalRequestKind } from "../services/legal-requests";
import { formAction, type FormState } from "./form-state";

export type LegalFormState = FormState & { receivedAt?: string; lines?: string[] };

async function submit(kind: LegalRequestKind, formData: FormData): Promise<LegalFormState> {
  let result: { receivedAt: string; lines: string[] } | null = null;
  const state = await formAction(async () => {
    // Unsichtbares Feld: Wer es ausfüllt, ist ein Bot – keine Mail, aber auch kein Hinweis darauf.
    if (String(formData.get("website") ?? "") !== "") {
      result = { receivedAt: formatReceivedAt(new Date()), lines: [] };
      return;
    }
    const raw = Object.fromEntries([...formData.entries()].filter(([key]) => key !== "website"));
    result = await submitLegalRequest(kind, raw, ipFromHeaders(await headers()));
  });
  return result ? { ...state, ...(result as { receivedAt: string; lines: string[] }) } : state;
}

export async function contactAction(_prev: LegalFormState, formData: FormData): Promise<LegalFormState> {
  return submit("kontakt", formData);
}

export async function reportAction(_prev: LegalFormState, formData: FormData): Promise<LegalFormState> {
  return submit("meldung", formData);
}

export async function withdrawalAction(_prev: LegalFormState, formData: FormData): Promise<LegalFormState> {
  return submit("widerruf", formData);
}

export async function cancellationAction(_prev: LegalFormState, formData: FormData): Promise<LegalFormState> {
  return submit("kuendigung", formData);
}
