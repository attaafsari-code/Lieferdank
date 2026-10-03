/**
 * Erzeugt realistische Demo-Daten für den Testmodus.
 *
 *   npm run seed
 *
 * Schreibt data/db.json – die Datei, die der Testspeicher (LIEFERDANK_DB=memory)
 * liest. Ein laufender Dev-Server muss danach neu gestartet werden.
 *
 * Die Geldlogik ist bewusst hier nachgebaut statt importiert: Das Skript läuft
 * mit plain Node, ohne TypeScript-Build. Die Tests prüfen, dass beide übereinstimmen.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { dirname, join } from "node:path";

const APPLICATION_FEES = { 200: 50, 300: 60, 500: 100 };
const PRESETS = ["freundlich", "paket", "hochtragen", "wetter", "einfach", "feierabend"];

/* ---------- Hilfen ---------- */

function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
}

/** Deterministischer Zufall: erneutes Seeding liefert vergleichbare Daten. */
let seed = 42;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(rnd() * list.length)];

/** Zeitpunkt vor `daysAgo` Tagen – nie in der Zukunft. */
function isoAt(daysAgo, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  const now = Date.now();
  if (d.getTime() > now) return new Date(now - Math.floor(rnd() * 90 * 60_000)).toISOString();
  return d.toISOString();
}

/* ---------- Bestand ---------- */

const db = {
  users: [],
  driverProfiles: [],
  customerProfiles: [],
  cardDesigns: [],
  cardOrders: [],
  payments: [],
  tips: [],
  thankYous: [],
  payouts: [],
  driverFavorites: [],
  verifications: [],
  milestones: [],
  adminActions: [],
  scans: [],
  passwordResets: [],
  systemEvents: [],
};

function addUser({ firstName, lastName, email, password, role, phone = null }) {
  const user = {
    id: randomUUID(),
    email,
    firstName,
    lastName,
    phone,
    role,
    passwordHash: hashPassword(password),
    tokenVersion: 0,
    createdAt: isoAt(40, 9, 0),
    // Demo-Zugänge gelten als bestätigt, damit sich alle Abläufe lokal durchspielen lassen.
    emailVerifiedAt: isoAt(40, 9, 5),
    blockedAt: null,
    blockedReason: null,
  };
  db.users.push(user);
  return user;
}

function addDriver(user, options) {
  const createdAt = isoAt(40, 9, 5);
  const driver = {
    id: randomUUID(),
    userId: user.id,
    code: options.code,
    nameDisplay: options.nameDisplay ?? "first",
    customName: options.customName ?? null,
    photoKey: null,
    photoPublic: true,
    providerId: options.providerId ?? null,
    providerPublic: true,
    tagline: options.tagline ?? null,
    bio: options.bio ?? null,
    city: options.city ?? null,
    verification: options.verification ?? "unverified",
    providerVerified: options.providerVerified ?? false,
    active: true,
    payoutAccountId: options.payoutReady ? `demo_acct_${user.id.slice(0, 8)}` : null,
    payoutReady: options.payoutReady ?? false,
    payoutSyncVersion: 0,
    notifyOnTip: true,
    createdAt,
    updatedAt: createdAt,
  };
  db.driverProfiles.push(driver);

  db.cardDesigns.push({
    id: randomUUID(),
    driverId: driver.id,
    layout: options.layout ?? "classic",
    headline: options.headline ?? "Danke für deine Wertschätzung ❤",
    showPhoto: false,
    showProvider: true,
    updatedAt: isoAt(30, 12, 0),
  });

  db.verifications.push({
    id: randomUUID(),
    userId: user.id,
    identityStatus: driver.verification,
    driverStatus: driver.verification,
    documentNote: options.documentNote ?? null,
    reviewNote: null,
    updatedAt: isoAt(25, 12, 0),
  });
  return driver;
}

function addTip(driver, grossCents, createdAt, customerId = null) {
  const tipId = randomUUID();
  const paymentId = randomUUID();
  const platformGrossFeeCents = APPLICATION_FEES[grossCents];
  const paymentProviderFeeCents = 0;

  db.payments.push({
    id: paymentId,
    purpose: "tip",
    referenceId: tipId,
    provider: "demo",
    providerPaymentId: `demo_${paymentId}`,
    providerIntentId: null,
    refundedAmountCents: 0,
    amountCents: grossCents,
    currency: "EUR",
    status: "succeeded",
    method: pick(["apple_pay", "google_pay", "card"]),
    failureReason: null,
    createdAt,
    updatedAt: createdAt,
  });

  const tip = {
    id: tipId,
    driverId: driver.id,
    paymentId,
    customerId,
    grossCents,
    driverCents: grossCents - platformGrossFeeCents,
    platformGrossFeeCents,
    paymentProviderFeeCents,
    payoutFeeCents: 0,
    platformNetRevenueCents: platformGrossFeeCents - paymentProviderFeeCents,
    refundedCents: 0,
    feeRefundedCents: 0,
    currency: "EUR",
    paymentStatus: "succeeded",
    payoutStatus: "in_balance",
    payoutId: null,
    destinationAccountId: `demo_acct_${driver.userId.slice(0, 8)}`,
    createdAt,
  };
  db.tips.push(tip);
  return tip;
}

/** Scans, Danke und Trinkgelder eines Tages. */
function addDay(driver, daysAgo, tipAmounts, freeThanks, customerId = null) {
  let hour = 9;
  const nextTime = () => {
    hour += 0.6 + rnd();
    return isoAt(daysAgo, Math.min(20, Math.floor(hour)), Math.floor(rnd() * 59));
  };

  for (const amount of tipAmounts) {
    const createdAt = nextTime();
    const tip = addTip(driver, amount, createdAt, customerId && rnd() < 0.3 ? customerId : null);
    db.thankYous.push({
      id: randomUUID(),
      driverId: driver.id,
      tipId: tip.id,
      customerId: tip.customerId,
      freeDay: null,
      visitorHash: null,
      presetId: rnd() < 0.65 ? pick(PRESETS) : null,
      message: null,
      createdAt,
    });
  }

  for (let i = 0; i < freeThanks; i++) {
    db.thankYous.push({
      id: randomUUID(),
      driverId: driver.id,
      tipId: null,
      customerId: null,
      freeDay: null,
      visitorHash: null,
      presetId: rnd() < 0.5 ? pick(PRESETS) : null,
      message: null,
      createdAt: nextTime(),
    });
  }

  // Nicht jeder Scan endet in einem Danke – realistische Conversion.
  const scans = Math.round((tipAmounts.length + freeThanks) * (1.6 + rnd()));
  for (let i = 0; i < scans; i++) db.scans.push({ id: randomUUID(), driverId: driver.id, createdAt: nextTime() });
}

/** Gleiche Regeln wie src/lib/milestone-rules.ts. */
function addMilestones(driver) {
  const thanks = db.thankYous.filter((t) => t.driverId === driver.id).length;
  const tips = db.tips.filter((t) => t.driverId === driver.id);
  const received = tips.reduce((sum, t) => sum + t.driverCents, 0);
  const reached = [];
  for (const step of [1, 10, 50, 100, 500, 1000]) if (thanks >= step) reached.push(["thank_you_count", step]);
  if (tips.length >= 1) reached.push(["first_tip", 1]);
  if (received >= 10_000) reached.push(["received_cents", 10_000]);
  if (driver.code === "LD-DEMO01") reached.push(["streak_days", 5]);

  reached.forEach(([type, value], index) => {
    db.milestones.push({
      id: randomUUID(),
      driverId: driver.id,
      type,
      value,
      achievedAt: isoAt(Math.max(0, 16 - index * 2), 15, 0),
    });
  });
}

/* ---------- Konten ---------- */

addUser({ firstName: "Lieferdank", lastName: "Admin", email: "admin@lieferdank.de", password: "lieferdank-admin", role: "admin" });

const maxUser = addUser({
  firstName: "Max",
  lastName: "Müller",
  email: "max@lieferdank.de",
  password: "lieferdank-demo",
  role: "driver",
  phone: "+49 151 0000000",
});
const max = addDriver(maxUser, {
  code: "LD-DEMO01",
  providerId: "dhl",
  providerVerified: true,
  verification: "verified",
  city: "Köln",
  payoutReady: true,
  tagline: "Seit sechs Jahren in eurem Viertel unterwegs.",
  bio: "Ich liebe es, wenn die Leute sich über ihr Paket freuen. Und ja – ich trage auch in den vierten Stock.",
  documentNote: "Dienstausweis und Arbeitsvertrag lagen bei der Prüfung vor.",
});

const ayseUser = addUser({ firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@lieferdank.de", password: "lieferdank-demo", role: "driver" });
const ayse = addDriver(ayseUser, {
  code: "LD-DEMO02",
  payoutReady: true,
  nameDisplay: "first_initial",
  providerId: "lieferando",
  city: "Hamburg",
  layout: "brand",
  headline: "Danke, dass ich dir dein Essen bringen durfte.",
  tagline: "Mit dem Rad durch Altona – bei jedem Wetter.",
});

const tobiUser = addUser({ firstName: "Tobias", lastName: "Krüger", email: "tobias@lieferdank.de", password: "lieferdank-demo", role: "driver" });
addDriver(tobiUser, {
  code: "LD-DEMO03",
  nameDisplay: "custom",
  customName: "Herr Krüger",
  providerId: "gls",
  city: "Leipzig",
  verification: "pending",
  layout: "personal",
  documentNote: "Ich fahre seit vier Monaten für einen GLS-Depotpartner in Leipzig. Dienstausweis kann ich zeigen.",
});

const lenaUser = addUser({ firstName: "Lena", lastName: "", email: "kunde@lieferdank.de", password: "lieferdank-demo", role: "customer" });
db.customerProfiles.push({ id: randomUUID(), userId: lenaUser.id, createdAt: isoAt(20, 18, 0) });

/* ---------- Verlauf ---------- */

// Heute: 7 Trinkgelder (18,50 € für Max) und 7 kostenlose Danke.
addDay(max, 0, [500, 500, 300, 300, 200, 200, 200], 7, lenaUser.id);
addDay(max, 1, [300, 200, 500, 200, 200, 300], 6, lenaUser.id);
addDay(max, 2, [200, 300, 300, 200], 5);
addDay(max, 3, [500, 200, 300, 200, 200], 6);
addDay(max, 4, [300, 300, 200], 4);
addDay(max, 5, [200, 500, 300, 200, 200], 6);
for (let d = 6; d <= 16; d++) addDay(max, d, [300, 200, 200], 5);

addDay(ayse, 0, [200, 300], 3, lenaUser.id);
addDay(ayse, 1, [200, 300, 200], 4);
addDay(ayse, 2, [500], 2);

for (const driver of [max, ayse]) addMilestones(driver);

// Lena hat beide gespeichert.
for (const driver of [max, ayse]) {
  db.driverFavorites.push({ id: randomUUID(), customerId: lenaUser.id, driverId: driver.id, nickname: null, createdAt: isoAt(10, 19, 0) });
}

// Eine bereits versendete Kartenbestellung für Max.
const orderAt = isoAt(12, 11, 0);
db.cardOrders.push({
  id: randomUUID(),
  driverId: max.id,
  product: "standard",
  quantity: 3,
  unitPriceCents: 0,
  totalCents: 0,
  currency: "EUR",
  paymentStatus: "not_required",
  paymentId: null,
  design: {
    layout: "classic",
    headline: "Danke für deine Wertschätzung ❤",
    showPhoto: false,
    showProvider: true,
    publicName: "Max",
    providerLabel: "DHL",
    code: "LD-DEMO01",
    qrUrl: "https://lieferdank.de/danke/LD-DEMO01",
  },
  shippingName: "Max Müller",
  shippingStreet: "Musterstraße 1",
  shippingPostalCode: "50667",
  shippingCity: "Köln",
  shippingCountry: "DE",
  status: "shipped",
  carrier: "DHL",
  trackingNumber: "00340434161234567890",
  reorderOf: null,
  createdAt: orderAt,
  updatedAt: isoAt(9, 14, 0),
  shippedAt: isoAt(9, 14, 0),
});

/* ---------- Schreiben ---------- */

const target = join(process.cwd(), "data", "db.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(db, null, 2), "utf8");

const todayKey = new Date().toDateString();
const maxToday = db.tips.filter((t) => t.driverId === max.id && new Date(t.createdAt).toDateString() === todayKey);

console.log(`Demo-Daten geschrieben: ${target}`);
console.log(`  ${db.driverProfiles.length} Lieferanten, ${db.customerProfiles.length} Kunde, ${db.thankYous.length} Danke, ${db.tips.length} Trinkgelder`);
console.log(`  Max heute: ${maxToday.length} Trinkgelder, ${(maxToday.reduce((s, t) => s + t.driverCents, 0) / 100).toFixed(2)} € verdient`);
console.log("");
console.log("Logins (Passwort):");
console.log("  Admin      admin@lieferdank.de   lieferdank-admin");
console.log("  Lieferant  max@lieferdank.de     lieferdank-demo");
console.log("  Kunde      kunde@lieferdank.de   lieferdank-demo");
console.log("  Kundenseite: /danke/LD-DEMO01 · /danke/LD-DEMO02 · /danke/LD-DEMO03");
