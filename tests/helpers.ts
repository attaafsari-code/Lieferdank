import { resetMemoryDatabase } from "@/lib/db/memory";
import { getDb } from "@/lib/db";
import { registerCustomer, registerDriver } from "@/server/services/auth";

export function freshDb() {
  resetMemoryDatabase();
  return getDb();
}

let counter = 0;

export async function makeDriver(overrides: { firstName?: string; lastName?: string } = {}) {
  counter += 1;
  const user = await registerDriver({
    firstName: overrides.firstName ?? "Max",
    lastName: overrides.lastName ?? "Müller",
    email: `fahrer${counter}@test.de`,
    phone: "+49 170 0000000",
    password: "sicheres-passwort",
    terms: "on",
  });
  const driver = (await getDb().driverProfiles.findOne({ userId: user.id }))!;
  return { user, driver };
}

export async function makeCustomer(saveCode = "") {
  counter += 1;
  return registerCustomer({ firstName: "Lena", email: `kundin${counter}@test.de`, password: "sicheres-passwort", terms: "on", saveCode });
}
