import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { homePathFor } from "@/server/services/auth";

export const dynamic = "force-dynamic";

/** Startpunkt der installierten App: je nach Rolle direkt ins richtige Zuhause. */
export default async function AppStart() {
  const session = await getSession();
  redirect(session ? homePathFor(session.user) : "/login");
}
