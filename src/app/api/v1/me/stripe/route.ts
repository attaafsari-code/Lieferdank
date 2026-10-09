import { APPLICATION_FEE_CENTS } from "@/lib/money";
import { z } from "zod";
import { api, readJson } from "@/server/api/handler";
import { parseInput } from "@/server/services/auth";
import { concludeTippingContract, startPayoutOnboarding, payoutReadinessAfterReturn, payoutsAreManual } from "@/server/services/payouts";
export const GET = api({ auth: "driver", rateLimit: { key: "app-stripe-status", limit: 30, windowMs: 600000 } }, async ({ session }) => {
  const driver = session!.driver!;
  const status = await payoutReadinessAfterReturn(driver);
  return { applicationFees: APPLICATION_FEE_CENTS, connected: Boolean(driver.payoutAccountId), ready: status.ready, verifiedNow: status.notice !== "unverified", notice: status.notice,
    manualPayouts: await payoutsAreManual(driver), emailVerified: Boolean(session!.user.emailVerifiedAt) };
});
export const POST = api({ auth: "driver", rateLimit: { key: "app-stripe-start", limit: 10, windowMs: 600000 } }, async ({ session, request }) => {
  const input = parseInput(z.object({ immediateStart: z.boolean() }), await readJson(request));
  await concludeTippingContract(session!.user, session!.driver!, input);
  return { url: await startPayoutOnboarding(session!.user, session!.driver!, true) };
});
