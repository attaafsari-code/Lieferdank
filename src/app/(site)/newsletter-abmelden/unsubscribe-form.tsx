"use client";
import { useActionState } from "react";
import { unsubscribeNewsletterAction } from "@/server/actions/newsletter";
import { keepInputs } from "@/components/keep-inputs";
export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unsubscribeNewsletterAction, {});
  if (state.saved) return <p role="status">Du bist vom Newsletter abgemeldet.</p>;
  return <form action={action} onSubmit={keepInputs(action)} className="space-y-4"><input type="hidden" name="token" value={token} />{state.error && <p role="alert" className="error-text">{state.error}</p>}<button className="btn btn-primary w-full" disabled={pending}>{pending ? "Einen Moment …" : "Vom Newsletter abmelden"}</button></form>;
}
