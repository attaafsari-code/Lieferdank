import Link from "next/link";
import { requireAdmin } from "@/server/guards";
import { LogoMark } from "@/components/logo";
import { DemoBanner } from "@/components/demo-banner";
import { logoutAction } from "@/server/actions/auth";
import { AdminNav } from "./admin-nav";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="text-lg font-extrabold tracking-tight text-brand-900">Lieferdank Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:block">{session.user.email}</span>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-quiet">
                Abmelden
              </button>
            </form>
          </div>
        </div>
        <AdminNav />
      </header>
      <main className="container-page flex-1 py-10">{children}</main>
    </div>
  );
}
