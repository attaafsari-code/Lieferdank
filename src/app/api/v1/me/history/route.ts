import { api } from "@/server/api/handler";
import { customerHistory } from "@/server/services/favorites";

export const dynamic = "force-dynamic";

/** Was ein Kunde während einer Anmeldung gegeben hat – nur die eigenen Einträge. */
export const GET = api({ auth: "customer" }, async ({ session }) => {
  const history = await customerHistory(session!.user.id);
  return {
    tipCount: history.tipCount,
    totalTipCents: history.totalTipCents,
    thankYous: history.thankYous.map(({ id, message, presetId, tipId, createdAt, driver }) => ({
      id, message, presetId, withTip: Boolean(tipId), createdAt,
      driver: driver ? { code: driver.code, name: driver.name, initials: driver.initials } : null,
    })),
  };
});
