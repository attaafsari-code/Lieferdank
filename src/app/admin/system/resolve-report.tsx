"use client";

import { useTransition, useState } from "react";
import { resolveMessageReportAction } from "@/server/actions/admin";

export function ResolveReport({ reportId }: { reportId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} className="btn btn-ghost btn-sm"
        onClick={() => start(async () => { const result = await resolveMessageReportAction(reportId); setError(result.error ?? ""); })}>
        {pending ? "Wird erledigt …" : "Erledigt"}
      </button>
      {error && <span className="text-xs font-semibold text-coral-600">{error}</span>}
    </span>
  );
}
