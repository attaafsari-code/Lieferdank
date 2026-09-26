export function AdminTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-[1.75rem] font-extrabold tracking-tight text-brand-900">{title}</h1>
      {lead && <p className="mt-1.5 text-sm text-ink-soft">{lead}</p>}
    </header>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-extrabold text-brand-900">{children}</h2>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-7 text-center text-ink-soft">{children}</p>;
}

export function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-xs ${highlight ? "border-brand-200 bg-brand-50" : "border-line bg-white"}`}>
      <p className="text-[0.6875rem] font-bold tracking-wide text-ink-faint uppercase">{label}</p>
      <p className="mt-1.5 text-xl font-extrabold tracking-tight text-brand-900">{value}</p>
    </div>
  );
}

export function Table({ head, children, minWidth = "48rem" }: { head: string[]; children: React.ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-xs">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="border-b border-line text-left text-xs font-bold tracking-wide text-ink-faint uppercase">
          <tr>
            {head.map((label) => (
              <th key={label} className="px-5 py-3.5 font-bold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, strong, mono }: { children: React.ReactNode; strong?: boolean; mono?: boolean }) {
  return (
    <td className={`px-5 py-3.5 whitespace-nowrap ${mono ? "font-mono text-xs" : ""} ${strong ? "font-bold text-brand-900" : "text-ink"}`}>
      {children}
    </td>
  );
}

const TONES = {
  blue: "bg-brand-50 text-brand",
  coral: "bg-coral-50 text-coral-600",
  gray: "bg-canvas text-ink-soft",
};

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`chip ${TONES[tone]}`}>{children}</span>;
}
