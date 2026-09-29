"use client";

import { useState, useTransition } from "react";
import type { CardOrderStatus } from "@/lib/db/types";
import {
  regenerateCodeAction,
  reviewBadgeAction,
  setProviderVerifiedAction,
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
  providerVerified,
  hasProvider,
}: {
  userId: string;
  driverId: string | null;
  blocked: boolean;
  providerVerified: boolean;
  hasProvider: boolean;
}) {
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState("");
  const { pending, error, done, run } = useAction();

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {driverId && hasProvider && (
          <Small disabled={pending} onClick={() => run(() => setProviderVerifiedAction(driverId, !providerVerified))}>
            {providerVerified ? "Anbieter ungeprüft" : "Anbieter geprüft"}
          </Small>
        )}
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
