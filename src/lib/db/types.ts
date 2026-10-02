/**
 * Datenmodell von Lieferdank.
 *
 * Alle Geldbeträge sind Integer in Cent. Alle Zeitpunkte sind ISO-Strings (UTC).
 * Die Tabellennamen in Postgres sind die snake_case-Pluralformen, siehe DATABASE.md.
 */

export type Role = "driver" | "customer" | "admin";

export type User = {
  id: string;
  /** Immer kleingeschrieben gespeichert. */
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  passwordHash: string;
  /** Wird bei jedem Passwortwechsel erhöht und macht ältere Sessions ungültig. */
  tokenVersion: number;
  createdAt: string;
  blockedAt: string | null;
  blockedReason: string | null;
};

/** Welcher Name öffentlich auf Karte und Kundenseite steht. */
export type NameDisplay = "first" | "last" | "first_initial" | "full" | "custom";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export type DriverProfile = {
  id: string;
  userId: string;
  /** Dauerhafter Lieferdank-Code, z. B. LD-84K2P. Ändert sich nie durch Profiländerungen. */
  code: string;
  nameDisplay: NameDisplay;
  customName: string | null;
  /** Schlüssel im Dateispeicher, nie eine öffentliche URL. */
  photoKey: string | null;
  /** false = Foto nur im Dashboard sichtbar. */
  photoPublic: boolean;
  providerId: string | null;
  providerPublic: boolean;
  /** Kurzer persönlicher Text für Karte und Kundenseite. */
  tagline: string | null;
  /** Längere Beschreibung, nur auf der Kundenseite. */
  bio: string | null;
  /** Intern, wird nie öffentlich angezeigt. */
  city: string | null;
  /** Freiwilliges Vertrauensabzeichen – keine Voraussetzung für irgendetwas. */
  verification: VerificationStatus;
  providerVerified: boolean;
  active: boolean;
  payoutAccountId: string | null;
  payoutReady: boolean;
  /**
   * Zählt jeden gespeicherten Stripe-Abgleich von payoutReady. Nur dafür da:
   * ein paralleler, älterer Abgleich erkennt daran, dass er überholt wurde.
   */
  payoutSyncVersion: number;
  notifyOnTip: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerProfile = {
  id: string;
  userId: string;
  createdAt: string;
};

export type CardLayout = "classic" | "brand" | "personal";

export type CardDesign = {
  id: string;
  driverId: string;
  layout: CardLayout;
  headline: string;
  showPhoto: boolean;
  showProvider: boolean;
  updatedAt: string;
};

/** Eingefrorener Stand einer Karte zum Bestellzeitpunkt. */
export type CardSnapshot = {
  layout: CardLayout;
  headline: string;
  showPhoto: boolean;
  showProvider: boolean;
  publicName: string;
  providerLabel: string | null;
  code: string;
  qrUrl: string;
};

export type PaymentPurpose = "tip" | "card_order";
/** review_required excludes money from balances until Stripe and Connect are reconciled. */
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "review_required";

/** Eine Transaktion beim Zahlungsdienstleister. Quelle der Wahrheit für den Zahlungsstatus. */
export type Payment = {
  id: string;
  purpose: PaymentPurpose;
  /** ID des Trinkgelds bzw. der Kartenbestellung. */
  referenceId: string;
  provider: string;
  /** Checkout-Session o. ä. */
  providerPaymentId: string | null;
  /** PaymentIntent o. ä. – wird für Rückerstattungen gebraucht. */
  providerIntentId: string | null;
  amountCents: number;
  /** Cumulative amount reported by Stripe charge.refunded; never decreases. */
  refundedAmountCents: number;
  currency: string;
  status: PaymentStatus;
  /** card, apple_pay, google_pay, paypal … sofern der Provider es meldet. */
  method: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayoutStatus = "pending" | "in_balance" | "paid_out";

export type Tip = {
  id: string;
  driverId: string;
  paymentId: string;
  /** Nur gesetzt, wenn ein eingeloggter Kunde gegeben hat. Für den Zusteller nie sichtbar. */
  customerId: string | null;
  grossCents: number;
  driverCents: number;
  platformGrossFeeCents: number;
  paymentProviderFeeCents: number;
  /** Historische DB-Spalte; neue Direct Charges tragen hier 0. */
  payoutFeeCents: number;
  platformNetRevenueCents: number;
  currency: string;
  /** Spiegel von Payment.status für schnelle Auswertungen. */
  paymentStatus: PaymentStatus;
  payoutStatus: PayoutStatus;
  payoutId: string | null;
  /**
   * Konto des Zustellers für den Direct Charge. Null ist nur historisch möglich;
   * neue Trinkgelder ohne Stripe-Zielkonto sind verboten.
   */
  destinationAccountId: string | null;
  createdAt: string;
};

export type ThankYou = {
  id: string;
  driverId: string;
  tipId: string | null;
  customerId: string | null;
  /** Nur bei kostenlosen Danksagungen; Berliner Kalendertag. */
  freeDay?: string | null;
  /** Pro Fahrer und Tag abgeleiteter Hash, kein roher Cookie-Wert. */
  visitorHash?: string | null;
  presetId: string | null;
  message: string | null;
  createdAt: string;
};

export type Payout = {
  id: string;
  driverId: string;
  amountCents: number;
  /** Tatsächlich überwiesener Teil (der Rest lag schon beim Zusteller). */
  transferredCents: number;
  feeCents: number;
  status: "pending" | "paid" | "failed";
  provider: string;
  providerTransferId: string | null;
  tipIds: string[];
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type DriverFavorite = {
  id: string;
  /** users.id des Kunden. */
  customerId: string;
  driverId: string;
  nickname: string | null;
  createdAt: string;
};

export type CardProduct = "standard" | "personalized";
export type CardOrderStatus =
  | "requested"
  | "confirmed"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

export type CardOrder = {
  id: string;
  driverId: string;
  product: CardProduct;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  currency: string;
  paymentStatus: "not_required" | "pending" | "paid" | "failed" | "refunded" | "review_required";
  paymentId: string | null;
  design: CardSnapshot;
  shippingName: string;
  shippingStreet: string;
  shippingPostalCode: string;
  shippingCity: string;
  shippingCountry: string;
  status: CardOrderStatus;
  carrier: string | null;
  trackingNumber: string | null;
  reorderOf: string | null;
  createdAt: string;
  updatedAt: string;
  shippedAt: string | null;
};

export type Verification = {
  id: string;
  userId: string;
  identityStatus: VerificationStatus;
  driverStatus: VerificationStatus;
  documentNote: string | null;
  reviewNote: string | null;
  updatedAt: string;
};

export type Milestone = {
  id: string;
  driverId: string;
  type: string;
  value: number;
  achievedAt: string;
};

export type AdminAction = {
  id: string;
  actorEmail: string;
  targetId: string;
  action: string;
  reason: string | null;
  createdAt: string;
};

export type Scan = {
  id: string;
  driverId: string;
  createdAt: string;
};

export type PasswordReset = {
  id: string;
  userId: string;
  /** Nur der SHA-256-Hash, nie das Token selbst. */
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

/** Technische Ereignisse für den Adminbereich: fehlgeschlagene Zahlungen, Mails, Webhooks. */
export type SystemEvent = {
  id: string;
  level: "info" | "warning" | "error";
  source: string;
  message: string;
  context: Record<string, unknown> | null;
  createdAt: string;
};

/** Alle Tabellen mit ihrem Zeilentyp. Der Schlüssel ist der Name im Code. */
export type Tables = {
  users: User;
  driverProfiles: DriverProfile;
  customerProfiles: CustomerProfile;
  cardDesigns: CardDesign;
  cardOrders: CardOrder;
  payments: Payment;
  tips: Tip;
  thankYous: ThankYou;
  payouts: Payout;
  driverFavorites: DriverFavorite;
  verifications: Verification;
  milestones: Milestone;
  adminActions: AdminAction;
  scans: Scan;
  passwordResets: PasswordReset;
  systemEvents: SystemEvent;
};

export type TableName = keyof Tables;

export type Database = { [K in TableName]: Tables[K][] };

export const TABLE_NAMES: TableName[] = [
  "users",
  "driverProfiles",
  "customerProfiles",
  "cardDesigns",
  "cardOrders",
  "payments",
  "tips",
  "thankYous",
  "payouts",
  "driverFavorites",
  "verifications",
  "milestones",
  "adminActions",
  "scans",
  "passwordResets",
  "systemEvents",
];

export function emptyDatabase(): Database {
  return Object.fromEntries(TABLE_NAMES.map((name) => [name, []])) as unknown as Database;
}
