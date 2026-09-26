export type Role = "driver" | "admin";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  passwordHash: string;
  createdAt: string;
  blockedAt: string | null;
  blockedReason: string | null;
  /**
   * Wird bei jedem Passwortwechsel erhoeht. Sessions mit einer aelteren
   * Version gelten sofort als ungueltig -- damit fliegt ein Angreifer nach
   * einem Passwort-Reset zuverlaessig raus.
   */
  tokenVersion: number;
};

export type PasswordReset = {
  id: string;
  userId: string;
  /** Nur der Hash wird gespeichert, nie das Token selbst. */
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export type DriverProfile = {
  id: string;
  userId: string;
  /** Anzeigename auf der Kundenseite, z. B. "Max". */
  displayName: string;
  /** Lieferdank-Code, z. B. LD-84K2P. Global eindeutig. */
  code: string;
  providerId: string | null;
  /** Wurde die Anbieterangabe geprueft? Nur dann darf sie prominent erscheinen (§19). */
  providerVerified: boolean;
  verification: VerificationStatus;
  active: boolean;
  city: string | null;
  /** Konto beim Payment-Provider (z. B. Stripe Connect Account-ID). */
  payoutAccountId: string | null;
  /** Ist das Auszahlungskonto einsatzbereit? */
  payoutReady: boolean;
  createdAt: string;
};

export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";
export type PayoutStatus = "pending" | "in_balance" | "paid_out";

export type Tip = {
  id: string;
  driverId: string;
  grossCents: number;
  driverCents: number;
  platformGrossFeeCents: number;
  paymentProviderFeeCents: number;
  platformNetRevenueCents: number;
  currency: string;
  paymentStatus: PaymentStatus;
  payoutStatus: PayoutStatus;
  provider: string;
  providerPaymentId: string | null;
  /**
   * Konto des Zustellers beim Zahlungsdienstleister, falls der Anteil direkt
   * dorthin geflossen ist. Ist es null, haelt die Plattform das Geld noch und
   * muss es beim Auszahlen aktiv ueberweisen.
   */
  destinationAccountId: string | null;
  createdAt: string;
};

export type ThankYou = {
  id: string;
  driverId: string;
  /** id aus PRESET_MESSAGES oder null. */
  presetId: string | null;
  /** Optionaler kurzer Freitext. */
  message: string | null;
  /** Verknuepfte Trinkgeldzahlung, falls vorhanden. */
  tipId: string | null;
  createdAt: string;
};

export type Verification = {
  id: string;
  userId: string;
  identityStatus: VerificationStatus;
  driverStatus: VerificationStatus;
  /** Beschreibung des eingereichten Nachweises. Dokumente liegen im MVP nicht oeffentlich. */
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

/** Ein Scan der Kundenseite. Basis fuer die Scan-to-Payment Conversion (§80). */
export type Scan = {
  id: string;
  driverId: string;
  createdAt: string;
};

export type Database = {
  users: User[];
  passwordResets: PasswordReset[];
  driverProfiles: DriverProfile[];
  tips: Tip[];
  thankYous: ThankYou[];
  verifications: Verification[];
  milestones: Milestone[];
  adminActions: AdminAction[];
  scans: Scan[];
};

export function emptyDatabase(): Database {
  return {
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
}
