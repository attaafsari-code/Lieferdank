export type Period = { thanks: number; tipCount: number; driverCents: number };
export type Stats = { today: Period; week: Period; month: Period; total: Period; streakDays: number; recentThankYous: Thank[]; milestones: { id: string; value: number; type: string }[] };
export type Thank = { id: string; message: string | null; presetId: string | null; tipId: string | null; createdAt: string };
export type Earning = { id: string; grossCents: number; shareBeforeStripeCents: number; refundedCents: number; paymentStatus: string; createdAt: string };
export type Profile = { firstName: string; lastName: string; email: string; emailVerified: boolean; phone: string | null; nameDisplay: string; customName: string | null; tagline: string | null; bio: string | null; city: string | null; photoPublic: boolean; hasPhoto: boolean; active: boolean; notifyOnTip: boolean };
export type StripeStatus = { applicationFees: Record<string, number>; connected: boolean; ready: boolean; verifiedNow: boolean; notice: string; manualPayouts: boolean; emailVerified: boolean };
export type Qr = { code: string; url: string; qrSvg: string; qrPng: string; cardSvg: string };
