/**
 * Erzeugt realistische Demo-Daten (§81, §82).
 *
 *   node scripts/seed.mjs
 *
 * Schreibt data/db.json -- die Datei, die der Memory-/Datei-Store liest.
 * Ein laufender Dev-Server muss danach neu gestartet werden.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { dirname, join } from "node:path";

const PLATFORM_FEE = 50;
const PROVIDER_FEE_PERCENT = 1.5;
const PROVIDER_FEE_FIXED = 25;

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const PRESETS = ["freundlich", "paket", "hochtragen", "wetter", "einfach", "feierabend"];

function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

function code(length = 5) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `LD-${out}`;
}

/** Deterministischer Zufall, damit ein erneutes Seeding vergleichbar bleibt. */
let seed = 42;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(rnd() * list.length)];

function isoAt(daysAgo, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  // Demo-Daten duerfen nie in der Zukunft liegen -- sonst steht ueberall
  // "gerade eben" und die Sortierung nach Aktualitaet wirkt falsch.
  const now = Date.now();
  if (d.getTime() > now) return new Date(now - Math.floor(rnd() * 90 * 60_000)).toISOString();
  return d.toISOString();
}

function makeTip(driverId, grossCents, createdAt) {
  const platformGrossFeeCents = Math.min(PLATFORM_FEE, grossCents);
  const paymentProviderFeeCents = Math.round(
    (grossCents * PROVIDER_FEE_PERCENT) / 100 + PROVIDER_FEE_FIXED,
  );
  return {
    id: randomUUID(),
    driverId,
    grossCents,
    driverCents: grossCents - platformGrossFeeCents,
    platformGrossFeeCents,
    paymentProviderFeeCents,
    platformNetRevenueCents: platformGrossFeeCents - paymentProviderFeeCents,
    currency: "EUR",
    paymentStatus: "succeeded",
    payoutStatus: "in_balance",
    provider: "demo",
    providerPaymentId: `demo_seed_${randomUUID().slice(0, 8)}`,
    destinationAccountId: null,
    createdAt,
  };
}

const db = {
  users: [],
  passwordResets: [],
  driverProfiles: [],
  tips: [],
  thankYous: [],
  verifications: [],
  milestones: [],
  adminActions: [],
  scans: [],
};

function addUser({ name, email, password, role = "driver", phone = null }) {
  const user = {
    id: randomUUID(),
    name,
    email,
    phone,
    role,
    passwordHash: hashPassword(password),
    createdAt: isoAt(30, 9, 0),
    blockedAt: null,
    blockedReason: null,
    tokenVersion: 0,
  };
  db.users.push(user);
  return user;
}

function addDriver(user, options) {
  const driver = {
    id: randomUUID(),
    userId: user.id,
    displayName: options.displayName,
    code: options.code ?? code(),
    providerId: options.providerId ?? null,
    providerVerified: options.providerVerified ?? false,
    verification: options.verification ?? "unverified",
    active: options.active ?? true,
    city: options.city ?? null,
    payoutAccountId: options.payoutReady ? `demo_acct_${user.id.slice(0, 8)}` : null,
    payoutReady: options.payoutReady ?? false,
    createdAt: isoAt(30, 9, 5),
  };
  db.driverProfiles.push(driver);
  db.verifications.push({
    id: randomUUID(),
    userId: user.id,
    identityStatus: driver.verification,
    driverStatus: driver.verification,
    documentNote: options.documentNote ?? null,
    reviewNote: null,
    updatedAt: isoAt(20, 12, 0),
  });
  return driver;
}

/** Erzeugt Scans, Danke und Trinkgelder eines Tages. */
function addDay(driver, daysAgo, tipAmounts, freeThanks) {
  let hour = 9;
  const nextTime = () => {
    hour += 0.6 + rnd();
    const h = Math.min(20, Math.floor(hour));
    return isoAt(daysAgo, h, Math.floor(rnd() * 59));
  };

  for (const amount of tipAmounts) {
    const createdAt = nextTime();
    const tip = makeTip(driver.id, amount, createdAt);
    db.tips.push(tip);
    const withMessage = rnd() < 0.65;
    db.thankYous.push({
      id: randomUUID(),
      driverId: driver.id,
      presetId: withMessage ? pick(PRESETS) : null,
      message: null,
      tipId: tip.id,
      createdAt,
    });
  }

  for (let i = 0; i < freeThanks; i++) {
    const createdAt = nextTime();
    const withMessage = rnd() < 0.5;
    db.thankYous.push({
      id: randomUUID(),
      driverId: driver.id,
      presetId: withMessage ? pick(PRESETS) : null,
      message: null,
      tipId: null,
      createdAt,
    });
  }

  // Realistische Scanrate: nicht jeder Scan endet in einem Danke.
  const scans = Math.round((tipAmounts.length + freeThanks) * (1.6 + rnd()));
  for (let i = 0; i < scans; i++) {
    db.scans.push({ id: randomUUID(), driverId: driver.id, createdAt: nextTime() });
  }
}

function addMilestones(driver, thankYouCount) {
  for (const step of [1, 10, 25, 50, 100, 250]) {
    if (thankYouCount >= step) {
      db.milestones.push({
        id: randomUUID(),
        driverId: driver.id,
        type: "thank_you_count",
        value: step,
        achievedAt: isoAt(Math.max(0, 14 - Math.floor(step / 10)), 15, 0),
      });
    }
  }
  db.milestones.push({
    id: randomUUID(),
    driverId: driver.id,
    type: "streak_days",
    value: 5,
    achievedAt: isoAt(1, 18, 0),
  });
}

/* ---------- Konten ---------- */

addUser({
  name: "Lieferdank Admin",
  email: "admin@lieferdank.de",
  password: "lieferdank-admin",
  role: "admin",
});

const maxUser = addUser({
  name: "Max Mustermann",
  email: "max@lieferdank.de",
  password: "lieferdank-demo",
  phone: "+49 151 0000000",
});
const max = addDriver(maxUser, {
  displayName: "Max",
  code: "LD-DEMO01",
  providerId: "dhl",
  providerVerified: true,
  verification: "verified",
  city: "Köln",
  payoutReady: true,
  documentNote: "Dienstausweis und Arbeitsvertrag lagen bei der Prüfung vor.",
});

const ayseUser = addUser({
  name: "Ayşe Yılmaz",
  email: "ayse@lieferdank.de",
  password: "lieferdank-demo",
});
const ayse = addDriver(ayseUser, {
  displayName: "Ayşe",
  code: "LD-DEMO02",
  providerId: "hermes",
  providerVerified: false,
  verification: "verified",
  city: "Hamburg",
  payoutReady: false,
});

const tobiUser = addUser({
  name: "Tobias Krüger",
  email: "tobias@lieferdank.de",
  password: "lieferdank-demo",
});
addDriver(tobiUser, {
  displayName: "Tobias",
  code: "LD-DEMO03",
  providerId: "gls",
  verification: "pending",
  city: "Leipzig",
  documentNote:
    "Ich fahre seit vier Monaten als Subunternehmer für einen GLS-Depotpartner in Leipzig. Dienstausweis kann ich zeigen.",
});

/* ---------- Verlauf ---------- */

// Heute: 7 Trinkgelder (18,50 EUR fuer Max) und 7 kostenlose Danke.
addDay(max, 0, [500, 500, 300, 300, 200, 200, 200], 7);
addDay(max, 1, [300, 200, 500, 200, 200, 300], 6);
addDay(max, 2, [200, 300, 300, 200], 5);
addDay(max, 3, [500, 200, 300, 200, 200], 6);
addDay(max, 4, [300, 300, 200], 4);
addDay(max, 5, [200, 500, 300, 200, 200], 6);
for (let d = 6; d <= 16; d++) {
  addDay(max, d, [300, 200, 200], 5);
}

addDay(ayse, 0, [200, 300], 3);
addDay(ayse, 1, [200, 300, 200], 4);
addDay(ayse, 2, [200], 2);

addMilestones(max, db.thankYous.filter((t) => t.driverId === max.id).length);
addMilestones(ayse, db.thankYous.filter((t) => t.driverId === ayse.id).length);

/* ---------- Schreiben ---------- */

const target = join(process.cwd(), "data", "db.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(db, null, 2), "utf8");

const maxThanks = db.thankYous.filter((t) => t.driverId === max.id);
const todayKey = new Date().toDateString();
const todayTips = db.tips.filter(
  (t) => t.driverId === max.id && new Date(t.createdAt).toDateString() === todayKey,
);

console.log(`Demo-Daten geschrieben: ${target}`);
console.log(`  Zusteller: ${db.driverProfiles.length}, Danke: ${db.thankYous.length}, Trinkgelder: ${db.tips.length}`);
console.log(`  Max (LD-DEMO01): ${maxThanks.length} Danke gesamt, heute ${todayTips.length} Trinkgelder`);
console.log(`  heute verdient: ${(todayTips.reduce((s, t) => s + t.driverCents, 0) / 100).toFixed(2)} EUR`);
console.log("");
console.log("Logins:");
console.log("  Admin    admin@lieferdank.de / lieferdank-admin");
console.log("  Zusteller max@lieferdank.de  / lieferdank-demo");
console.log("  Kundenseite: /danke/LD-DEMO01");
