"use client";

import { useState, useTransition } from "react";
import type { CardOrderStatus } from "@/lib/db/types";
import { formatEuro } from "@/lib/format";
import { parseEuroToCents, refundPreview } from "@/lib/money";
import {
  refundTipAction,
  regenerateCodeAction,
  reviewBadgeAction,
  setUserBlockedAction,
  updateCardOrderAction,
} from "@/server/actions/admin";

type Result = { error?: string; fieldErrors?: Record<string, string> };

function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  function run(action: () => Promise<Result>, success?: string) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await action();
      if (result.error || result.fieldErrors) setError(result.error ?? Object.values(result.fieldErrors ?? {})[0] ?? "Fehler");
      else if (success) setDone(success);
    });
  }
  return { pending, error, done, run };
}

function Feedback({ error, done }: { error: string | null; done: string | null }) {
  if (error) return <p role="alert" className="mt-2 text-sm font-semibold text-coral-600">{error}</p>;
  if (done) return <p className="mt-2 text-sm font-semibold text-brand">{done}</p>;
  return null;
}

export function BadgeReview({ driverId }: { driverId: string }) {
  const [note, setNote] = useState("");
  const { pending, error, done, run } = useAction();
  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anmerkung – bei Ablehnung Pflicht" className="field flex-1 !py-2.5 text-sm" />
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => run(() => reviewBadgeAction(driverId, "verified", note), "Bestätigt")} className="btn btn-primary btn-sm">
            Bestätigen
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => reviewBadgeAction(driverId, "rejected", note), "Abgelehnt")} className="btn btn-ghost btn-sm">
            Ablehnen
          </button>
        </div>
      </div>
      <Feedback error={error} done={done} />
    </div>
  );
}

type Confirm = "block" | "code" | null;

export function UserControls({
  userId,
  driverId,
  blocked,
}: {
  userId: string;
  driverId: string | null;
  blocked: boolean;
}) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState("");
  const { pending, error, done, run } = useAction();

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {driverId && (
          <Small disabled={pending} onClick={() => setConfirm("code")}>
            Code neu erzeugen
          </Small>
        )}
        {blocked ? (
          <Small disabled={pending} onClick={() => run(() => setUserBlockedAction(userId, false, ""), "Entsperrt")}>
            Entsperren
          </Small>
        ) : (
          <Small danger disabled={pending} onClick={() => setConfirm("block")}>
            Sperren
          </Small>
        )}
      </div>

      {confirm && (
        <div className={`mt-3 rounded-2xl p-4 ${confirm === "block" ? "bg-coral-50" : "bg-canvas"}`}>
          <p className="text-sm font-semibold text-ink">
            {confirm === "block"
              ? "Konto sperren. Alle Sessions werden beendet, der Danke-Code funktioniert nicht mehr."
              : "Neuen Code erzeugen. Nur bei Missbrauch – gedruckte Karten funktionieren danach nicht mehr."}
          </p>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Grund (Pflicht, wird protokolliert)" className="field mt-3 !py-2.5 text-sm" autoFocus />
          <div className="mt-3 flex gap-2.5">
            <button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={() => {
                const action = confirm === "block" ? () => setUserBlockedAction(userId, true, reason) : () => regenerateCodeAction(driverId!, reason);
                run(action, confirm === "block" ? "Gesperrt" : "Neuer Code erzeugt");
                setConfirm(null);
                setReason("");
              }}
              className={`btn btn-sm ${confirm === "block" ? "btn-coral" : "btn-primary"}`}
            >
              Bestätigen
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="btn btn-ghost btn-sm">
              Abbrechen
            </button>
          </div>
        </div>
      )}
      <Feedback error={error} done={done} />
    </div>
  );
}

const ORDER_STATUSES: { id: CardOrderStatus; label: string }[] = [
  { id: "requested", label: "Eingegangen" },
  { id: "confirmed", label: "Bestätigt" },
  { id: "in_production", label: "In Produktion" },
  { id: "shipped", label: "Versendet" },
  { id: "delivered", label: "Zugestellt" },
  { id: "cancelled", label: "Storniert" },
];

export function OrderControls({ orderId, status, carrier, trackingNumber }: { orderId: string; status: CardOrderStatus; carrier: string | null; trackingNumber: string | null }) {
  const [next, setNext] = useState<CardOrderStatus>(status);
  const [carrierValue, setCarrier] = useState(carrier ?? "");
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [reason, setReason] = useState("");
  const { pending, error, done, run } = useAction();
  return (
    <div className="mt-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
        <select value={next} onChange={(e) => setNext(e.target.value as CardOrderStatus)} className="field !py-2.5 text-sm">
          {ORDER_STATUSES.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <input value={carrierValue} onChange={(e) => setCarrier(e.target.value)} placeholder="Versanddienst" className="field !py-2.5 text-sm" />
        <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Sendungsnummer" className="field !py-2.5 text-sm" />
        <button type="button" disabled={pending || !reason.trim()} onClick={() => run(() => updateCardOrderAction(orderId, next, carrierValue, tracking, reason), next === "shipped" && status !== "shipped" ? "Gespeichert – Versandmail verschickt" : "Gespeichert")} className="btn btn-primary btn-sm">
          Speichern
        </button>
      </div>
      <label className="mt-2 block text-xs font-semibold text-ink-soft">Grund der Statusänderung
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={250} className="field mt-1 !py-2.5 text-sm" />
      </label>
      <Feedback error={error} done={done} />
    </div>
  );
}

type RefundableTip = { id: string; grossCents: number; driverCents: number; platformGrossFeeCents: number; refundedCents: number; feeRefundedCents: number };

/**
 * Trinkgeld erstatten: Betrag wählen, Zusammenfassung prüfen, ausdrücklich bestätigen.
 * Der Auftrag gilt nur für den hier angezeigten Erstattungsstand – ein zweiter Klick oder ein
 * erneutes Absenden kann deshalb nicht doppelt erstatten.
 */
export function TipRefund({ tip }: { tip: RefundableTip }) {
  const remaining = tip.grossCents - tip.refundedCents;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const { pending, error, done, run } = useAction();

  const parsed = mode === "full" ? remaining : parseEuroToCents(amount);
  const valid = parsed !== null && parsed > 0 && parsed <= remaining;
  const preview = valid ? refundPreview(tip, parsed) : null;

  if (!open) {
    return (
      <div>
        <Small disabled={pending} onClick={() => setOpen(true)}>Erstatten</Small>
        <Feedback error={error} done={done} />
      </div>
    );
  }
  return (
    <div className="w-72 rounded-2xl bg-canvas p-4 whitespace-normal">
      <p className="text-sm font-semibold text-ink">Trinkgeld erstatten</p>
      <p className="mt-1 text-xs text-ink-soft">
        Gezahlt {formatEuro(tip.grossCents)}, bisher erstattet {formatEuro(tip.refundedCents)}, offen {formatEuro(remaining)}.
      </p>
      <div className="mt-3 flex gap-2">
        <Small disabled={pending || confirming} onClick={() => setMode("full")}>{mode === "full" ? "● " : ""}Alles ({formatEuro(remaining)})</Small>
        <Small disabled={pending || confirming} onClick={() => setMode("partial")}>{mode === "partial" ? "● " : ""}Teilbetrag</Small>
      </div>
      {mode === "partial" && (
        <label className="mt-3 block text-xs font-semibold text-ink-soft">Betrag in Euro
          <input value={amount} onChange={(e) => setAmount(e.target.value)} disabled={confirming} inputMode="decimal" placeholder="z. B. 1,50" className="field mt-1 !py-2.5 text-sm" />
        </label>
      )}
      <label className="mt-3 block text-xs font-semibold text-ink-soft">Grund (Pflicht, wird protokolliert)
        <input value={reason} onChange={(e) => setReason(e.target.value)} disabled={confirming} maxLength={250} className="field mt-1 !py-2.5 text-sm" />
      </label>

      {mode === "partial" && amount.trim() !== "" && !valid && (
        <p className="mt-2 text-xs font-semibold text-coral-600">Bitte einen Betrag zwischen 0,01 € und {formatEuro(remaining)} angeben.</p>
      )}
      {preview && (
        <dl className="mt-3 space-y-1 rounded-xl bg-white p-3 text-xs text-ink">
          <div className="flex justify-between gap-3"><dt>Kunde erhält zurück</dt><dd className="font-bold">{formatEuro(preview.customerCents)}</dd></div>
          <div className="flex justify-between gap-3"><dt>davon gibt Lieferdank Gebühr zurück</dt><dd className="font-bold">{formatEuro(preview.feeBackCents)}</dd></div>
          <div className="flex justify-between gap-3"><dt>trägt der Zusteller (Stripe-Guthaben)</dt><dd className="font-bold">{formatEuro(preview.driverBearsCents)}</dd></div>
          <div className="flex justify-between gap-3 border-t border-line pt-1"><dt>bleibt dem Zusteller vor Stripe-Kosten</dt><dd className="font-bold">{formatEuro(preview.after.driverCents)}</dd></div>
          <div className="flex justify-between gap-3"><dt>bleibt Lieferdank als Gebühr</dt><dd className="font-bold">{formatEuro(preview.after.platformFeeCents)}</dd></div>
        </dl>
      )}
      {preview && (
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-ink-soft">
          Die Erstattung läuft über Stripe aus dem Guthaben des Zustellers. Stripes Zahlungskosten der ursprünglichen Zahlung werden nicht
          erstattet. {preview.complete ? "Das Trinkgeld ist danach vollständig erstattet." : "Das Trinkgeld bleibt teilweise bestehen."}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!confirming ? (
          <button type="button" disabled={pending || !preview || !reason.trim()} onClick={() => setConfirming(true)} className="btn btn-primary btn-sm">
            Zusammenfassung prüfen
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || !preview || !reason.trim()}
            onClick={() => {
              const cents = mode === "full" ? null : parsed;
              run(() => refundTipAction(tip.id, cents, tip.refundedCents, reason), "Erstattung ausgelöst");
              // Ein weiterer Auftrag wird bewusst neu ausgefüllt – nichts bleibt zum schnellen Wiederholen stehen.
              setMode("full");
              setAmount("");
              setReason("");
              setConfirming(false);
              setOpen(false);
            }}
            className="btn btn-coral btn-sm"
          >
            {pending ? "Einen Moment …" : `Jetzt ${formatEuro(preview?.customerCents ?? 0)} erstatten`}
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => { setConfirming(false); setOpen(false); }} className="btn btn-ghost btn-sm">
          Abbrechen
        </button>
      </div>
      <Feedback error={error} done={done} />
    </div>
  );
}

function Small({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        danger ? "border-coral-100 bg-coral-50 text-coral-600 hover:border-coral" : "border-line bg-white text-ink hover:border-brand-200 hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}
