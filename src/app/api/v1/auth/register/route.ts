import { api, readJson } from "@/server/api/handler";
import {
  customerRegistrationSchema,
  driverRegistrationSchema,
  parseInput,
  registerCustomer,
  registerDriver,
} from "@/server/services/auth";
import { signSessionToken } from "@/server/session";

/** Registrierung aus der App: { role: "driver" | "customer", … }. */
export const POST = api({ rateLimit: { key: "api-register", limit: 5, windowMs: 10 * 60_000 } }, async ({ request }) => {
  const body = await readJson(request);
  // In der App gibt es keine Checkbox – die Zustimmung kommt als Boolean.
  const input = { ...body, terms: body.acceptedTerms === true ? "on" : undefined };
  const user =
    body.role === "customer"
      ? await registerCustomer(parseInput(customerRegistrationSchema, input))
      : await registerDriver(parseInput(driverRegistrationSchema, input));
  return {
    token: await signSessionToken(user),
    user: { id: user.id, role: user.role, firstName: user.firstName, email: user.email },
  };
});
