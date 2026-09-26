import type {
  AdminAction,
  PasswordReset,
  DriverProfile,
  Milestone,
  ThankYou,
  Tip,
  User,
  Verification,
} from "./types";

/**
 * Alle Datenbankzugriffe laufen ueber dieses Interface.
 * Grund: Der MVP startet ohne externe Infrastruktur (Memory/Datei),
 * die Feldtest-/Produktivumgebung nutzt Supabase Postgres.
 * Die Anwendungslogik kennt den Unterschied nicht.
 */
export interface Store {
  // Users
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  createUser(user: User): Promise<User>;
  updateUser(id: string, patch: Partial<User>): Promise<void>;
  listUsers(): Promise<User[]>;

  // Passwort zuruecksetzen
  createPasswordReset(reset: PasswordReset): Promise<void>;
  getPasswordResetByTokenHash(tokenHash: string): Promise<PasswordReset | null>;
  markPasswordResetUsed(id: string): Promise<void>;
  invalidatePasswordResets(userId: string): Promise<void>;

  // Driver profiles
  getDriverById(id: string): Promise<DriverProfile | null>;
  getDriverByUserId(userId: string): Promise<DriverProfile | null>;
  getDriverByCode(code: string): Promise<DriverProfile | null>;
  createDriverProfile(profile: DriverProfile): Promise<DriverProfile>;
  updateDriverProfile(id: string, patch: Partial<DriverProfile>): Promise<void>;
  listDrivers(): Promise<DriverProfile[]>;

  // Tips
  createTip(tip: Tip): Promise<Tip>;
  getTipById(id: string): Promise<Tip | null>;
  getTipByProviderPaymentId(providerPaymentId: string): Promise<Tip | null>;
  updateTip(id: string, patch: Partial<Tip>): Promise<void>;
  listTipsByDriver(driverId: string): Promise<Tip[]>;
  listTips(): Promise<Tip[]>;

  // Thank yous
  createThankYou(thankYou: ThankYou): Promise<ThankYou>;
  getThankYouById(id: string): Promise<ThankYou | null>;
  updateThankYou(id: string, patch: Partial<ThankYou>): Promise<void>;
  listThankYousByDriver(driverId: string): Promise<ThankYou[]>;
  listThankYous(): Promise<ThankYou[]>;

  // Scans (Conversion-Messung)
  createScan(driverId: string, id: string, createdAt: string): Promise<void>;
  countScans(filter?: { driverId?: string; sinceIso?: string }): Promise<number>;

  // Verification
  getVerificationByUserId(userId: string): Promise<Verification | null>;
  upsertVerification(verification: Verification): Promise<void>;
  listVerifications(): Promise<Verification[]>;

  // Milestones
  createMilestone(milestone: Milestone): Promise<void>;
  listMilestonesByDriver(driverId: string): Promise<Milestone[]>;

  // Admin
  createAdminAction(action: AdminAction): Promise<void>;
  listAdminActions(): Promise<AdminAction[]>;
}
