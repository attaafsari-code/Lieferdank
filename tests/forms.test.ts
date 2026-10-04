import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../src");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(file);
    return entry.name.endsWith(".tsx") ? [file] : [];
  });
}

describe("Formulare mit Server Actions", () => {
  // React setzt ein Formular nach jeder Action zurück. Ohne keepInputs verliert ein Nutzer bei einem
  // Eingabefehler alle Felder, und gesteuerte Auswahlfelder zeigen nach dem Speichern den alten Wert.
  it("behalten ihre Eingaben: jedes useActionState-Formular schickt über keepInputs ab", () => {
    const withActionState = sources(SRC).filter((file) => readFileSync(file, "utf8").includes("useActionState("));
    expect(withActionState.length).toBeGreaterThanOrEqual(10);

    const offenders = withActionState.filter((file) => {
      const forms = readFileSync(file, "utf8").match(/<form\b[^>]*>/g) ?? [];
      return forms.length === 0 || forms.some((form) => !form.includes("action={action} onSubmit={keepInputs(action)}"));
    });
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });
});

describe("Dashboard", () => {
  it("zeigt als „Danke gesamt“ dieselbe Zahl wie die Zeitraumwerte und die Danke-Seite", () => {
    const dashboard = readFileSync(path.join(SRC, "app/dashboard/page.tsx"), "utf8");
    expect(dashboard).toContain('value={String(stats.total.thanks)} label="Danke gesamt"');
    expect(readFileSync(path.join(SRC, "app/dashboard/danke/page.tsx"), "utf8")).toContain("stats.total.thanks");
  });
});
