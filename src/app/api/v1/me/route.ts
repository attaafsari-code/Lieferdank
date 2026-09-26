import { api } from "@/server/api/handler";
import { toPublicDriver } from "@/server/services/drivers";

export const dynamic = "force-dynamic";

export const GET = api({ auth: "any" }, async ({ session }) => {
  const { user, driver } = session!;
  return {
    user: {
      id: user.id,
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    driver: driver ? { ...toPublicDriver(driver, user), active: driver.active, payoutReady: driver.payoutReady } : null,
  };
});
