import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { DemoBanner } from "@/components/demo-banner";
import { DashboardNav } from "./nav";
import { logout } from "@/lib/actions/auth-actions";

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.driver) redirect(session.user.role === "admin" ? "/admin" : "/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />

      <header className="no-print sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] w-full max-w-4xl items-center justify-between px-5">
          <Link href="/dashboard" aria-label="Zum Dashboard">
            <Logo />
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-lg bg-canvas px-2.5 py-1.5 font-mono text-[0.8125rem] font-semibold tracking-wide text-ink-soft sm:block">
              {session.driver.code}
            </span>
            <form action={logout}>
              <button type="submit" className="btn btn-quiet">
                Abmelden
              </button>
            </form>
          </div>
        </div>

        <DashboardNav />
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-8 pb-16">{children}</main>
    </div>
  );
}
