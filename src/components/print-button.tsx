"use client";

import { Printer } from "./icons";

export function PrintButton({ label = "Karte drucken" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary no-print">
      <Printer className="h-[1.05rem] w-[1.05rem]" />
      {label}
    </button>
  );
}
