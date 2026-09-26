"use client";

import { useState, useTransition } from "react";
import { removeFavoriteAction, renameFavoriteAction, deleteCustomerAccountAction } from "@/server/actions/customer";

export function FavoriteRow({ favoriteId, nickname }: { favoriteId: string; nickname: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nickname ?? "");
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            await renameFavoriteAction(favoriteId, value);
            setEditing(false);
          });
        }}
      >
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={40}
          placeholder="Eigener Name, z. B. „Paketbote Nachbarschaft“"
          className="field flex-1 !py-2.5 text-sm"
          autoFocus
        />
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
          Speichern
        </button>
      </form>
    );
  }

  return (
    <div className="mt-3 flex gap-4 border-t border-line pt-3 text-xs font-semibold">
      <button type="button" onClick={() => setEditing(true)} className="text-ink-soft hover:text-brand">
        Umbenennen
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => void (await removeFavoriteAction(favoriteId)))}
        className="text-ink-soft hover:text-coral-600"
      >
        Entfernen
      </button>
    </div>
  );
}

export function DeleteCustomerAccount() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm font-semibold text-coral-600 hover:underline">
        Konto löschen
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <span className="text-sm text-ink">Wirklich löschen?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteCustomerAccountAction())}
        className="btn btn-coral btn-sm"
      >
        Ja, löschen
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost btn-sm">
        Nein
      </button>
    </span>
  );
}
