import Link from "next/link";
import { requireCustomer } from "@/server/guards";
import { customerHistory, listFavorites } from "@/server/services/favorites";
import { formatEuro, formatRelative } from "@/lib/format";
import { presetById } from "@/lib/messages";
import { Avatar } from "@/components/avatar";
import { Heart } from "@/components/icons";
import { logoutAction } from "@/server/actions/auth";
import { FavoriteRow, DeleteCustomerAccount } from "./favorite-controls";
import { EmailVerificationNotice } from "@/components/email-verification-notice";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meine Lieferanten", robots: { index: false, follow: false } };

export default async function CustomerAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { user } = await requireCustomer();
  const query = await searchParams;
  const [favorites, history] = await Promise.all([listFavorites(user.id), customerHistory(user.id)]);

  return (
    <div className="container-page max-w-2xl py-12 sm:py-16">
      <header>
        <p className="eyebrow">Dein Konto</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-900">Meine Lieferanten</h1>
        <p className="mt-2 text-ink-soft">
          Hier findest du alle, denen du schon einmal Danke gesagt und die du gespeichert hast.
        </p>
      </header>

      {!user.emailVerifiedAt && (
        <div className="mt-6">
          <EmailVerificationNotice email={user.email} />
        </div>
      )}

      {query.gespeichert === "1" && (
        <p className="mt-6 rounded-2xl bg-brand-50 px-4 py-3.5 text-sm font-semibold text-brand-900">
          Gespeichert. Ab jetzt findest du den Lieferanten hier.
        </p>
      )}

      <section className="mt-10">
        {favorites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-10 text-center">
            <p className="font-semibold text-ink">Noch niemand gespeichert</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Scanne beim nächsten Mal den Lieferdank-Code deines Lieferanten und tippe nach dem Danke
              auf „speichern“.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {favorites.map((favorite) => (
              <li key={favorite.favoriteId} className="rounded-2xl border border-line bg-white p-4 shadow-xs sm:p-5">
                <div className="flex items-center gap-4">
                  <Avatar
                    name={favorite.driver.name}
                    initials={favorite.driver.initials}
                    photoUrl={favorite.driver.photoUrl}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink">{favorite.nickname || favorite.driver.name}</p>
                    <p className="truncate text-sm text-ink-soft">
                      {favorite.nickname ? `${favorite.driver.name} · ` : ""}
                      Lieferant
                    </p>
                  </div>
                  {favorite.active ? (
                    <Link href={`/danke/${favorite.driver.code}`} className="btn btn-coral btn-sm shrink-0">
                      <Heart className="h-4 w-4" />
                      Danke
                    </Link>
                  ) : (
                    <span className="chip shrink-0 bg-canvas text-ink-faint">pausiert</span>
                  )}
                </div>
                <FavoriteRow favoriteId={favorite.favoriteId} nickname={favorite.nickname} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {history.thankYous.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-extrabold text-brand-900">Dein Verlauf</h2>
          {history.tipCount > 0 && (
            <p className="mt-1 text-sm text-ink-soft">
              {history.tipCount} Trinkgelder, insgesamt {formatEuro(history.totalTipCents)}
            </p>
          )}
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
            {history.thankYous.map((entry) => {
              const preset = presetById(entry.presetId);
              return (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">
                      {entry.driver?.name ?? "Lieferant"}
                      {entry.tipId && <span className="ml-2 text-xs font-medium text-coral">mit Trinkgeld</span>}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">
                      {preset ? `${preset.emoji} ${preset.text}` : entry.message ?? "Danke"} · {formatRelative(entry.createdAt)}
                    </span>
                  </span>
                  {entry.driver && (
                    <Link href={`/danke/${entry.driver.code}`} className="text-sm font-semibold text-brand hover:underline">
                      Wieder Danke sagen
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-14 space-y-4 rounded-2xl border border-line bg-white p-6 shadow-xs">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <span className="min-w-0 break-words text-sm text-ink-soft">Angemeldet als {user.email}</span>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-quiet">
              Abmelden
            </button>
          </form>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <span className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="/api/datenexport" className="text-sm font-semibold text-brand hover:underline">
              Meine Daten herunterladen
            </a>
            <Link href="/passwort-vergessen" className="text-sm font-semibold text-brand hover:underline">
              Passwort ändern
            </Link>
          </span>
          <DeleteCustomerAccount />
        </div>
      </section>

      <p className="mt-8 text-center text-xs leading-relaxed text-ink-faint">
        Lieferanten sehen nie, wer sie gespeichert hat oder wer ihnen Danke gesagt hat.
      </p>
    </div>
  );
}
