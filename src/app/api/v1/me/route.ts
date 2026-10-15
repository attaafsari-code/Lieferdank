import { api } from "@/server/api/handler";
import { toPublicDriver } from "@/server/services/drivers";

export const dynamic = "force-dynamic";

export const GET = api({ auth: "any" }, async ({ session }) => {
  const { user, driver, customer } = session!;
  return {
    user: {
      id: user.id,
      role: user.role,
      roles: user.role === "admin" ? ["admin"] : [...(driver ? ["driver"] : []), ...(customer ? ["customer"] : [])],
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: Boolean(user.emailVerifiedAt),
    },
    driver: driver ? { ...toPublicDriver(driver, user), active: driver.active, payoutReady: driver.payoutReady } : null,
  };
});
