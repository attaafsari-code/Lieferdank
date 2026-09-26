"use client";

import { useState, useTransition } from "react";
import { Check } from "@/components/icons";
import { MAX_CUSTOM_MESSAGE_LENGTH, PRESET_MESSAGES } from "@/lib/messages";
import { attachMessageAction } from "@/server/actions/customer-flow";

export function MessageForm({ thankYouId }: { thankYouId: string }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(presetId: string | null, message: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await attachMessageAction(thankYouId, presetId, message);
      if (result.ok) setSent(true);
      else setError(result.error ?? "Das hat nicht geklappt.");
    });
  }

  if (sent) {
    return (
      <p className="mt-9 flex items-center justify-center gap-2 rounded-2xl bg-brand-50 px-5 py-4 text-center text-sm font-semibold text-brand-900">
        <Check className="h-4 w-4 text-brand" />
        Deine Nachricht ist unterwegs.
      </p>
    );
  }

  return (
    <section className="mt-9">
      <p className="text-center font-bold text-ink">Möchtest du noch etwas sagen?</p>
      <p className="mt-1 text-center text-sm text-ink-soft">Optional – ein Tipp genügt.</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {PRESET_MESSAGES.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={pending}
            onClick={() => {
              setSelected(m.id);
              submit(m.id, null);
            }}
            className={`flex items-center gap-2.5 rounded-2xl border-[1.5px] bg-white px-4 py-3.5 text-left text-[0.9375rem] font-semibold transition disabled:opacity-50 ${
              selected === m.id
                ? "border-brand text-brand shadow-sm"
                : "border-line text-ink hover:border-brand-200 hover:shadow-xs"
            }`}
          >
            <span aria-hidden className="text-lg leading-none">
              {m.emoji}
            </span>
            {m.text}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <label htmlFor="custom-message" className="label">
          Oder eigene Nachricht
        </label>
        <textarea
          id="custom-message"
          rows={2}
          maxLength={MAX_CUSTOM_MESSAGE_LENGTH}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Kurz und freundlich – wird später gelesen."
          className="field resize-none"
        />
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-faint">
            {custom.length}/{MAX_CUSTOM_MESSAGE_LENGTH}
          </span>
          <button
            type="button"
            disabled={pending || custom.trim().length === 0}
            onClick={() => submit(null, custom)}
            className="btn btn-primary btn-sm"
          >
            {pending ? "Wird gesendet …" : "Nachricht senden"}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-center text-sm font-semibold text-coral-600">
          {error}
        </p>
      )}
    </section>
  );
}
