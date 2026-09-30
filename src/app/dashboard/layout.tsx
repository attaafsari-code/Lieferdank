import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { homePathFor } from "@/server/services/auth";
import { Logo } from "@/components/logo";
import { DemoBanner } from "@/components/demo-banner";
import { logoutAction } from "@/server/actions/auth";
import { DashboardBottomBar, DashboardTabs } from "./nav";

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.driver) redirect(homePathFor(session.user));

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />

      <header
        className="no-print sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-2 px-4 sm:px-5">
          <Link href="/dashboard" aria-label="Zum Dashboard" className="min-w-0 shrink-0">
            <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:flex" />
          </Link>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <Link href="/dashboard/karte" aria-label={`Mein QR-Code · ${session.driver.code}`} className="min-w-0 rounded-lg bg-canvas px-2 py-1.5 text-xs font-semibold text-brand hover:bg-brand-50 sm:px-2.5 sm:text-[0.8125rem]">
              <span className="sm:hidden">QR-Code</span>
              <span className="hidden sm:block">Mein QR-Code · <span className="font-mono">{session.driver.code}</span></span>
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-quiet">
                Abmelden
              </button>
            </form>
          </div>
        </div>
        <DashboardTabs />
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-8 pb-28 md:pb-16">{children}</main>
      <DashboardBottomBar />
    </div>
  );
}
