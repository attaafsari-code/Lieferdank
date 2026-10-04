"use client";

import { useActionState, useState, useTransition } from "react";
import { FormAlert, FormField } from "@/components/form-field";
import { keepInputs } from "@/components/keep-inputs";
import { formatEuro } from "@/lib/format";
import type { CardQuote } from "@/lib/pricing";
import { cancelCardOrderAction, createCardOrderAction } from "@/server/actions/driver";
import type { FormState } from "@/server/actions/form-state";

const initial: FormState = {};

type Props = {
  quotes: CardQuote[];
  paid: boolean;
  defaults: { shippingName: string; shippingStreet: string; shippingPostalCode: string; shippingCity: string };
  reorderOf?: string;
};

export function OrderForm({ quotes, paid, defaults, reorderOf }: Props) {
  const [state, action, pending] = useActionState(createCardOrderAction, initial);
  const [quantity, setQuantity] = useState(quotes[0]?.quantity ?? 1);
  const errors = state.fieldErrors ?? {};
  const quote = quotes.find((q) => q.quantity === quantity) ?? quotes[0];

  return (
    <form action={action} onSubmit={keepInputs(action)} className="space-y-6" noValidate>
      {reorderOf && <input type="hidden" name="reorderOf" value={reorderOf} />}
      <input type="hidden" name="quantity" value={quantity} />

      <fieldset>
        <legend className="label">Anzahl</legend>
        <div className="grid grid-cols-3 gap-2">
          {quotes.map((option) => (
            <button
              key={option.quantity}
              type="button"
              onClick={() => setQuantity(option.quantity)}
              aria-pressed={quantity === option.quantity}
              className={`rounded-2xl border-[1.5px] px-3 py-3 text-center transition ${
                quantity === option.quantity ? "border-brand bg-brand-50" : "border-line bg-white hover:border-brand-200"
              }`}
            >
              <span className="block text-lg font-extrabold text-ink">{option.quantity}×</span>
              <span className="block text-xs text-ink-soft">
                {option.free ? "kostenlos" : formatEuro(option.totalCents)}
                {!option.free && option.discountPercent > 0 && ` · −${option.discountPercent} %`}
              </span>
            </button>
          ))}
        </div>
        {errors.quantity && <p className="error-text">{errors.quantity}</p>}
      </fieldset>

      <div className="space-y-4">
        <p className="label !mb-0">Lieferadresse</p>
        <FormField id="shippingName" label="Name" autoComplete="name" defaultValue={defaults.shippingName} error={errors.shippingName} />
        <FormField
          id="shippingStreet"
          label="Straße und Hausnummer"
          autoComplete="street-address"
          defaultValue={defaults.shippingStreet}
          error={errors.shippingStreet}
        />
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <FormField
            id="shippingPostalCode"
            label="PLZ"
            autoComplete="postal-code"
            defaultValue={defaults.shippingPostalCode}
            error={errors.shippingPostalCode}
          />
          <FormField id="shippingCity" label="Ort" autoComplete="address-level2" defaultValue={defaults.shippingCity} error={errors.shippingCity} />
        </div>
        <p className="text-xs text-ink-faint">Versand innerhalb Deutschlands. Die Adresse wird nie öffentlich angezeigt.</p>
      </div>

      <div className="flex items-baseline justify-between border-t border-line pt-5">
        <span className="text-ink-soft">Gesamt</span>
        <span className="text-2xl font-extrabold text-brand-900">{quote.free ? "0,00 €" : formatEuro(quote.totalCents)}</span>
      </div>
      {!paid && (
        <p className="-mt-3 text-xs text-ink-soft">Im Testbetrieb sind Karten kostenlos. Später wird hier der Preis bezahlt.</p>
      )}

      {state.error && <FormAlert>{state.error}</FormAlert>}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Wird bestellt …" : reorderOf ? "Erneut bestellen" : "Verbindlich bestellen"}
      </button>
    </form>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await cancelCardOrderAction(orderId)))}
      className="text-xs font-semibold text-ink-soft hover:text-coral-600"
    >
      Stornieren
    </button>
  );
}
