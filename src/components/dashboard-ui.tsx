import Link from "next/link";
import type { Milestone, ThankYou } from "@/lib/db/types";
import { describeMilestone } from "@/lib/milestones";
import { presetById } from "@/lib/messages";
import { formatRelative } from "@/lib/format";
import { Heart } from "./icons";

export function PageTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-9">
      <h1 className="text-[1.75rem] font-extrabold tracking-tight text-brand-900">{title}</h1>
      {lead && <p className="mt-1.5 leading-relaxed text-ink-soft">{lead}</p>}
    </div>
  );
}

export function StatTile({
  icon,
  value,
  label,
  tone = "brand",
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone?: "brand" | "coral";
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 shadow-xs">
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
          tone === "coral" ? "bg-coral-50 text-coral" : "bg-brand-50 text-brand"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[1.625rem] leading-none font-extrabold tracking-tight text-brand-900">
          {value}
        </span>
        <span className="mt-1 block text-sm text-ink-soft">{label}</span>
      </span>
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between gap-4">
      <h2 className="text-[1.0625rem] font-extrabold text-brand-900">{children}</h2>
      {action && (
        <Link
          href={action.href}
          className="shrink-0 text-sm font-semibold text-brand hover:underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-8 text-center leading-relaxed text-ink-soft">
      {children}
    </p>
  );
}

export function ThankYouList({ items }: { items: ThankYou[] }) {
  if (items.length === 0) {
    return (
      <EmptyState>
        Noch keine Nachrichten. Sobald ein Kunde deinen Code scannt, erscheint hier sein
        Danke.
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const preset = presetById(item.presetId);
        const text = preset ? `${preset.emoji} ${preset.text}` : item.message;
        return (
          <li
            key={item.id}
            className="flex items-start gap-3.5 rounded-2xl border border-line bg-white p-4 shadow-xs"
          >
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral-50">
              <Heart className="h-4 w-4 text-coral" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-ink">
                {text ?? <span className="text-ink-faint">Ein Danke ohne Nachricht</span>}
              </span>
              <span className="mt-1 block text-xs text-ink-faint">
                {formatRelative(item.createdAt)}
                {item.tipId && " · mit Trinkgeld"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function MilestoneList({ items }: { items: Milestone[] }) {
  if (items.length === 0) {
    return (
      <EmptyState>
        Dein erster Meilenstein wartet: Sobald dir jemand das erste Mal Danke sagt, findest
        du ihn hier.
      </EmptyState>
    );
  }

  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {items.map((milestone) => {
        const description = describeMilestone(milestone.type, milestone.value);
        return (
          <li
            key={milestone.id}
            className="flex items-center gap-3.5 rounded-2xl border border-line bg-white p-4 shadow-xs"
          >
            <span aria-hidden className="text-[1.625rem] leading-none">
              {description.emoji}
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-ink">{description.title}</span>
              <span className="block text-xs text-ink-faint">
                {formatRelative(milestone.achievedAt)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
