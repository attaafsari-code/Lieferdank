"use client";

import { useState, useTransition } from "react";
import {
  markPaidOut,
  regenerateCode,
  reviewVerification,
  setProviderVerified,
  setUserBlocked,
} from "@/lib/actions/admin-actions";

/** Entscheidung über eine Abzeichen-Anfrage. */
export function VerificationControls({ driverId }: { driverId: string }) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
      <input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Anmerkung – bei Ablehnung für den Zusteller sichtbar"
        className="field flex-1 !py-2.5 text-sm"
      />
      <div className="flex gap-2.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => reviewVerification(driverId, "verified", note))}
          className="btn btn-primary btn-sm"
        >
          Bestätigen
        </button>
        <button
          type="button"
          disabled={pending || note.trim().length === 0}
          onClick={() => startTransition(() => reviewVerification(driverId, "rejected", note))}
          className="btn btn-ghost btn-sm"
        >
          Ablehnen
        </button>
      </div>
    </div>
  );
}

type Pending = "block" | "code" | "payout" | null;

export function DriverControls({
  driverId,
  userId,
  blocked,
  providerVerified,
  hasProvider,
  balanceCents,
  balanceLabel,
}: {
  driverId: string;
  userId: string;
  blocked: boolean;
  providerVerified: boolean;
  hasProvider: boolean;
  balanceCents: number;
  balanceLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setConfirm(null);
    setReason("");
  }

  function runPayout() {
    setError(null);
    close();
    startTransition(async () => {
      const result = await markPaidOut(driverId);
      if (!result.ok) setError(result.error ?? "Die Auszahlung hat nicht geklappt.");
    });
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {hasProvider && (
          <Small
            pending={pending}
            onClick={() =>
              startTransition(() => setProviderVerified(driverId, !providerVerified))
            }
          >
            {providerVerified ? "Anbieter ungeprüft setzen" : "Anbieter als geprüft markieren"}
          </Small>
        )}
        <Small pending={pending} onClick={() => setConfirm("code")}>
          Code neu erzeugen
        </Small>
        {balanceCents > 0 && (
          <Small pending={pending} onClick={() => setConfirm("payout")}>
            Guthaben als ausgezahlt markieren
          </Small>
        )}
        <Small pending={pending} danger onClick={() => (blocked ? startTransition(() => setUserBlocked(userId, false, "")) : setConfirm("block"))}>
          {blocked ? "Entsperren" : "Konto sperren"}
        </Small>
      </div>

      {confirm === "code" && (
        <ConfirmBox
          text="Neuen Lieferdank-Code erzeugen? Bereits gedruckte Karten funktionieren danach nicht mehr."
          pending={pending}
          onConfirm={() => {
            startTransition(() => regenerateCode(driverId));
            close();
          }}
          onCancel={close}
        />
      )}

      {confirm === "payout" && (
        <ConfirmBox
          text={`Guthaben von ${balanceLabel} auszahlen? Anteile, die bereits direkt beim Zusteller gelandet sind, werden nur gebucht – der Rest wird überwiesen.`}
          confirmLabel="Auszahlen"
          pending={pending}
          onConfirm={runPayout}
          onCancel={close}
        />
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-coral-50 px-4 py-3 text-sm font-semibold text-coral-600">
          {error}
        </p>
      )}

      {confirm === "block" && (
        <ConfirmBox
          text="Konto sperren. Der Danke-Code funktioniert danach nicht mehr."
          pending={pending}
          confirmLabel="Sperren"
          danger
          disabled={reason.trim().length === 0}
          onConfirm={() => {
            startTransition(() => setUserBlocked(userId, true, reason));
            close();
          }}
          onCancel={close}
        >
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Grund für die Sperre (Pflicht)"
            className="field mt-3 !py-2.5 text-sm"
            autoFocus
          />
        </ConfirmBox>
      )}
    </div>
  );
}

function ConfirmBox({
  text,
  onConfirm,
  onCancel,
  pending,
  disabled,
  danger,
  confirmLabel = "Bestätigen",
  children,
}: {
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  disabled?: boolean;
  danger?: boolean;
  confirmLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`mt-3 rounded-2xl p-4 ${danger ? "bg-coral-50" : "bg-canvas"}`}
      role="group"
    >
      <p className="text-sm font-semibold text-ink">{text}</p>
      {children}
      <div className="mt-3 flex gap-2.5">
        <button
          type="button"
          disabled={pending || disabled}
          onClick={onConfirm}
          className={`btn btn-sm ${danger ? "btn-coral" : "btn-primary"}`}
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function Small({
  children,
  onClick,
  pending,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pending: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        danger
          ? "border-coral-100 bg-coral-50 text-coral-600 hover:border-coral"
          : "border-line bg-white text-ink hover:border-brand-200 hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}
