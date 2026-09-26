const BERLIN = "Europe/Berlin";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Tagesschluessel "YYYY-MM-DD" in deutscher Ortszeit. */
export function dayKey(date: Date | string = new Date()): string {
  return dayFormatter.format(typeof date === "string" ? new Date(date) : date);
}

function keyToUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Alle Tagesschluessel der aktuellen Kalenderwoche (Montag bis heute). */
export function currentWeekKeys(now: Date = new Date()): string[] {
  const todayKey = dayKey(now);
  const todayUtc = keyToUtc(todayKey);
  const weekday = (new Date(todayUtc).getUTCDay() + 6) % 7; // Montag = 0
  const keys: string[] = [];
  for (let i = weekday; i >= 0; i--) {
    keys.push(utcToKey(todayUtc - i * 86_400_000));
  }
  return keys;
}

/** Monatsschlüssel "YYYY-MM" in deutscher Ortszeit. */
export function monthKey(date: Date | string = new Date()): string {
  return dayKey(date).slice(0, 7);
}

export function previousDayKey(key: string, steps = 1): string {
  return utcToKey(keyToUtc(key) - steps * 86_400_000);
}

/** Zonen-Offset (in ms) zum angegebenen Zeitpunkt -- beruecksichtigt Sommerzeit. */
function zoneOffsetMs(instantMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BERLIN,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instantMs))
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - instantMs;
}

/**
 * Beginn des heutigen Tages (deutsche Ortszeit) als ISO-Zeitstempel.
 * Wird fuer zeitraumbezogene Zaehlungen in der Datenbank gebraucht.
 */
export function startOfTodayIso(now: Date = new Date()): string {
  const [y, m, d] = dayKey(now).split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d);
  // Zweiter Durchlauf faengt den Sonderfall an Zeitumstellungstagen ab.
  let utc = naive - zoneOffsetMs(naive);
  utc = naive - zoneOffsetMs(utc);
  return new Date(utc).toISOString();
}

/** Naechster Auszahlungstermin: Freitag der laufenden bzw. kommenden Woche (§78). */
export function nextPayoutDateLabel(now: Date = new Date()): string {
  const todayKey = dayKey(now);
  const todayUtc = keyToUtc(todayKey);
  const weekday = (new Date(todayUtc).getUTCDay() + 6) % 7; // Montag = 0
  const daysUntilFriday = (4 - weekday + 7) % 7 || 7;
  const target = new Date(todayUtc + daysUntilFriday * 86_400_000);
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(target);
}
