"use client";

import { useState } from "react";
import { Check } from "./icons";

export function CopyButton({ value, label = "Kopieren" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className="btn btn-ghost btn-sm shrink-0">
      {copied ? (
        <>
          <Check className="h-4 w-4 text-brand" /> Kopiert
        </>
      ) : (
        label
      )}
    </button>
  );
}
