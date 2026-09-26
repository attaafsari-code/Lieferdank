import { NextResponse } from "next/server";
import { isDemoDatabase } from "@/lib/db";
import { isDemoPayment } from "@/server/payments";
import { mailConfigured } from "@/server/mail";

export const dynamic = "force-dynamic";

/** Für Uptime-Monitoring. Verrät keine Geheimnisse, nur welcher Modus aktiv ist. */
export function GET() {
  return NextResponse.json({
    ok: true,
    database: isDemoDatabase() ? "memory" : "supabase",
    payments: isDemoPayment() ? "demo" : "stripe",
    mail: mailConfigured() ? "resend" : "log",
    time: new Date().toISOString(),
  });
}
