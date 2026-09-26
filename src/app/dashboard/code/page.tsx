import { redirect } from "next/navigation";

/** Früherer Pfad – QR-Code und Karte liegen jetzt gemeinsam unter /dashboard/karte. */
export default function LegacyCodePage() {
  redirect("/dashboard/karte");
}
