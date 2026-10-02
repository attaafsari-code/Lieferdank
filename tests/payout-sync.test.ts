import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Der Kontoabgleich gegen die Produktionssemantik: echter Supabase-Adapter, darunter ein
 * nachgebildetes PostgREST. Nachgebildet sind genau die Eigenschaften, an denen der Abgleich
 * hängt – eine Anweisung ist atomar, Filter werden in der Datenbank ausgewertet, und
 * timestamptz hat Mikrosekunden, die der Adapter beim Lesen auf Millisekunden kürzt.
 * Ein echtes Supabase ersetzt das nicht; es prüft aber mehr als der Memory-Speicher.
 */
const postgrest = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(?:Z|\+00:00)$/;
  const state = { tables: {} as Record<string, Row[]>, patches: [] as { filters: string[]; rows: number }[] };

  /** Postgres vergleicht timestamptz als Zeitpunkt mit Mikrosekunden-Auflösung. */
  const micros = (value: string): string => {
    const [, base, fraction = ""] = value.match(TIMESTAMP)!;
    return `${Date.parse(`${base}Z`)}${fraction.padEnd(6, "0").slice(0, 6)}`;
  };
  const equal = (stored: unknown, wanted: unknown): boolean =>
    typeof stored === "string" && TIMESTAMP.test(stored)
      ? TIMESTAMP.test(String(wanted)) && micros(stored) === micros(String(wanted))
      : String(stored) === String(wanted);
  /** PostgREST liefert Zeitstempel mit Offset statt „Z“. */
  const render = (row: Row): Row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
    [key, typeof value === "string" && TIMESTAMP.test(value) ? value.replace(/Z$/, "+00:00") : value]));

  function from(table: string) {
    const filters: [string, unknown, "eq" | "is"][] = [];
    let patch: Row | null = null;

    /** Eine SQL-Anweisung: Filter prüfen und schreiben geschieht in einem Schritt. */
    const run = (): Row[] => {
      const rows = (state.tables[table] ??= []);
      const columns = new Set(rows.flatMap((row) => Object.keys(row)));
      for (const column of [...filters.map(([name]) => name), ...Object.keys(patch ?? {})]) {
        if (!columns.has(column)) throw new Error(`column ${table}.${column} does not exist`);
      }
      const hit = rows.filter((row) => filters.every(([column, value, op]) =>
        op === "is" ? row[column] === value : equal(row[column], value)));
      if (patch) {
        state.patches.push({ filters: filters.map(([column, value]) => `${column}=${String(value)}`), rows: hit.length });
        for (const row of hit) Object.assign(row, patch);
      }
      return hit.map(render);
    };
    const execute = <T>(pick: (rows: Row[]) => T) => Promise.resolve().then(() => {
      try {
        return { data: pick(run()), error: null };
      } catch (error) {
        return { data: null, error: { message: (error as Error).message } };
      }
    });

    const builder = {
      select: () => builder,
      update: (values: Row) => { patch = values; return builder; },
      eq: (column: string, value: unknown) => { filters.push([column, value, "eq"]); return builder; },
      is: (column: string, value: unknown) => { filters.push([column, value, "is"]); return builder; },
      limit: () => builder,
      maybeSingle: () => execute((rows) => rows[0] ?? null),
      then: (resolve: (result: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        execute((rows) => rows).then(resolve, reject),
    };
    return builder;
  }
  return { state, client: { from } };
});

vi.mock("@supabase/supabase-js", () => ({ createClient: () => postgrest.client }));

import { getDb } from "@/lib/db";
import { supabaseDb } from "@/lib/db/supabase";
import { syncPayoutReadiness } from "@/server/services/payouts";

const DRIVER = "11111111-1111-4111-8111-111111111111";
const row = () => postgrest.state.tables.driver_profiles[0];
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Stripe aus Sicht des Tests: jeder Abruf sieht den Stand zum Zeitpunkt der Anfrage; wann er antwortet, bestimmt der Test. */
function stripe(initial: boolean) {
  let current = initial;
  const pending: { value: boolean; resolve: (value: boolean) => void; reject: (reason: Error) => void }[] = [];
  return {
    pending,
    change(value: boolean) { current = value; },
    read: () => new Promise<boolean>((resolve, reject) => { pending.push({ value: current, resolve, reject }); }),
    async answer(index = 0) {
      const [call] = pending.splice(index, 1);
      call.resolve(call.value);
      await flush();
    },
    async fail(index = 0) {
      const [call] = pending.splice(index, 1);
      call.reject(new Error("Stripe nicht erreichbar"));
      await flush();
    },
  };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length < 2) return [items];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
}

afterEach(() => { vi.useRealTimers(); });

beforeEach(() => {
  vi.stubEnv("LIEFERDANK_DB", "supabase");
  vi.stubEnv("SUPABASE_URL", "https://projekt.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "dummy");
  postgrest.state.patches.length = 0;
  postgrest.state.tables = {
    driver_profiles: [{
      id: DRIVER, user_id: "22222222-2222-4222-8222-222222222222", code: "LD-TESTSYNC01", tagline: null,
      payout_account_id: "acct_driver", payout_ready: false, payout_sync_version: 0,
      // So speichert Postgres einen per SQL gesetzten Zeitstempel: mit Mikrosekunden.
      created_at: "2026-10-01T08:00:00.123456+00:00", updated_at: "2026-10-01T08:00:00.123456+00:00",
    }],
  };
});

describe("Kontoabgleich mit Supabase-Semantik", () => {
  it("läuft tatsächlich über den Supabase-Adapter", () => {
    expect(getDb()).toBe(supabaseDb);
  });

  it("vergleicht die ganzzahlige Version in einer einzigen Anweisung – unabhängig von der Zeitstempel-Genauigkeit", async () => {
    // Warum updatedAt als Marke untauglich war: gelesen fehlen die Mikrosekunden, der Vergleich trifft nie.
    const read = (await supabaseDb.driverProfiles.get(DRIVER))!;
    expect(read.updatedAt).toBe("2026-10-01T08:00:00.123Z");
    expect(await supabaseDb.driverProfiles.updateIf(DRIVER, { updatedAt: read.updatedAt }, { payoutReady: true })).toBe(false);
    postgrest.state.patches.length = 0;

    expect(await syncPayoutReadiness(DRIVER, async () => true)).toBe(true);
    expect(row()).toMatchObject({ payout_ready: true, payout_sync_version: 1 });
    // Genau ein Schreibzugriff, bedingt auf Zeile UND Version – kein bedingungsloses Nachschreiben.
    expect(postgrest.state.patches).toEqual([{ filters: [`id=${DRIVER}`, "payout_sync_version=0"], rows: 1 }]);
  });

  it("lässt von zwei gleichzeitigen Schreibversuchen mit derselben Version genau einen gewinnen", async () => {
    const attempts = await Promise.all([true, false].map((ready) =>
      supabaseDb.driverProfiles.updateIf(DRIVER, { payoutSyncVersion: 0 }, { payoutReady: ready, payoutSyncVersion: 1 })));
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(row().payout_sync_version).toBe(1);
  });

  it.each([[false, true], [true, false]])(
    "schreibt bei drei parallelen Abgleichen in keiner Antwortreihenfolge einen älteren Stand über einen neueren (%s → %s)",
    async (before, after) => {
      // Die Uhr steht: alle Schreibzugriffe tragen denselben Zeitstempel wie die gelesene Zeile. Genau dann
      // hätte die frühere updatedAt-Marke einen Konflikt nicht erkannt bzw. bedingungslos „repariert“.
      vi.useFakeTimers({ now: Date.parse("2026-10-01T08:00:00.123Z"), toFake: ["Date"] });
      // Der Stand bei Stripe wechselt vor dem k-ten Abruf; die Antworten treffen in jeder möglichen Reihenfolge ein.
      for (let changeBefore = 0; changeBefore <= 3; changeBefore++) {
        for (const order of permutations([0, 1, 2])) {
          const label = `Wechsel vor Abruf ${changeBefore}, Antworten ${order.join("")}`;
          Object.assign(row(), { payout_ready: before, payout_sync_version: 0 });
          postgrest.state.patches.length = 0;
          const api = stripe(before);
          const written: boolean[] = [];
          const handlers: Promise<void>[] = [];
          for (let handler = 0; handler < 3; handler++) {
            if (handler === changeBefore) api.change(after);
            handlers.push(syncPayoutReadiness(DRIVER, api.read).then((ready) => { written.push(ready); }));
            await flush();
          }
          expect(api.pending, label).toHaveLength(3);
          // Erst die drei ersten Abrufe in der vorgegebenen Reihenfolge beantworten, dann alle Wiederholungen.
          const first = [...api.pending];
          for (const index of order) await api.answer(api.pending.indexOf(first[index]));
          while (api.pending.length > 0) await api.answer();
          await Promise.all(handlers);

          // Ist der neue Stand einmal gespeichert, darf der alte nie wieder gespeichert werden.
          const firstNew = written.indexOf(after);
          expect(firstNew === -1 ? [] : written.slice(firstNew), label).not.toContain(before);
          expect(row().payout_ready, label).toBe(changeBefore < 3 ? after : before);
          // Jeder erfolgreiche Abgleich erhöht die Version um genau eins; jeder Verlierer hat neu gelesen.
          expect(row().payout_sync_version, label).toBe(3);
          expect(postgrest.state.patches.filter((patch) => patch.rows === 1), label).toHaveLength(3);
          // Kein einziger Schreibzugriff ohne Versionsbedingung.
          expect(postgrest.state.patches.every((patch) => patch.filters.some((filter) => filter.startsWith("payout_sync_version="))), label).toBe(true);
        }
      }
    });

  it("wird von einer Profiländerung während des Stripe-Abrufs weder gestört noch überschreibt er sie", async () => {
    const api = stripe(true);
    const sync = syncPayoutReadiness(DRIVER, api.read);
    await flush();
    // Jemand speichert sein Profil, während Stripe noch antwortet.
    await supabaseDb.driverProfiles.update(DRIVER, { tagline: "Neu im Viertel", updatedAt: new Date().toISOString() });
    await api.answer();
    expect(await sync).toBe(true);
    expect(api.pending).toHaveLength(0);
    expect(row()).toMatchObject({ payout_ready: true, payout_sync_version: 1, tagline: "Neu im Viertel" });
  });

  it("schreibt nichts, wenn Stripe in der Wiederholung nach einem Konflikt ausfällt", async () => {
    Object.assign(row(), { payout_ready: false });
    const api = stripe(false);
    const older = syncPayoutReadiness(DRIVER, api.read);
    await flush();
    api.change(true);
    const newer = syncPayoutReadiness(DRIVER, api.read);
    await flush();
    await api.answer(1);
    expect(await newer).toBe(true);
    // Der ältere Abgleich verliert, liest neu – und Stripe fällt genau dann aus.
    const outcome = older.then(() => "gespeichert", (error: Error) => error.message);
    await api.answer(0);
    expect(api.pending).toHaveLength(1);
    await api.fail(0);
    expect(await outcome).toBe("Stripe nicht erreichbar");
    expect(row()).toMatchObject({ payout_ready: true, payout_sync_version: 1 });
    expect(postgrest.state.patches.filter((patch) => patch.rows === 1)).toHaveLength(1);
  });

  it("gibt nach drei verlorenen Versuchen auf, ohne zu schreiben", async () => {
    const overtaken = vi.fn(async () => {
      await syncPayoutReadiness(DRIVER, async () => true);
      return false;
    });
    await expect(syncPayoutReadiness(DRIVER, overtaken)).rejects.toThrow(/parallel abgeglichen/);
    expect(overtaken).toHaveBeenCalledTimes(3);
    expect(row()).toMatchObject({ payout_ready: true, payout_sync_version: 3 });
    // Die drei Schreibversuche des Verlierers haben keine Zeile getroffen.
    expect(postgrest.state.patches.filter((patch) => patch.rows === 0)).toHaveLength(3);
  });

  it("verweigert den Abgleich mit klarer Meldung, solange die Migration fehlt", async () => {
    delete row().payout_sync_version;
    const read = vi.fn(async () => true);
    await expect(syncPayoutReadiness(DRIVER, read)).rejects.toThrow(/20261002_payout_sync_version\.sql/);
    expect(read).not.toHaveBeenCalled();
    expect(row().payout_ready).toBe(false);
    expect(postgrest.state.patches).toHaveLength(0);
    // Auch ein direkter Schreibversuch scheitert an der Datenbank, statt still etwas zu ändern.
    await expect(supabaseDb.driverProfiles.updateIf(DRIVER, { payoutSyncVersion: 0 }, { payoutReady: true, payoutSyncVersion: 1 }))
      .rejects.toThrow(/does not exist/);
  });
});
