import { AuthShell } from "@/components/auth-shell";
import { UnsubscribeForm } from "./unsubscribe-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Newsletter abmelden", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <AuthShell title="Newsletter abmelden" lead="Dein LieferDank-Konto bleibt bestehen."><UnsubscribeForm token={(await searchParams).token ?? ""} /></AuthShell>;
}
