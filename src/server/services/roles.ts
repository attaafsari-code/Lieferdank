import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import type { User } from "@/lib/db/types";
import { createDriverProfile } from "./drivers";
import { parseInput } from "./auth";
import { ServiceError } from "../errors";

/** A second profile on the same identity. No new login, email or customer data is created. */
export async function enableDriver(actor: User, input: unknown) {
  if (actor.role === "admin" || actor.blockedAt) throw new ServiceError("forbidden", "Dieses Konto kann nicht umgestellt werden.", 403);
  const value = parseInput(z.object({ firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), acceptedTerms: z.literal(true) }), input);
  const db = getDb();
  const current = await db.users.get(actor.id);
  if (!current || current.blockedAt || current.role === "admin") throw new ServiceError("forbidden", "Dieses Konto kann nicht umgestellt werden.", 403);
  let driver = await db.driverProfiles.findOne({ userId: actor.id });
  if (!driver) {
    try { driver = await createDriverProfile(actor.id, new Date().toISOString()); }
    catch (error) {
      // user_id is UNIQUE in Postgres: a simultaneous activation may already have won.
      driver = await db.driverProfiles.findOne({ userId: actor.id });
      if (!driver) throw error;
    }
  }
  // Primary landing page becomes the dashboard. Existing customer profile/favorites remain.
  if (current.role === "customer") await db.users.updateIf(actor.id, { role: "customer", blockedAt: null }, {
    role: "driver", firstName: value.firstName, lastName: value.lastName,
  });
  const enabled = await db.users.get(actor.id);
  if (!enabled || enabled.blockedAt || enabled.role !== "driver") throw new ServiceError("forbidden", "Dieses Konto kann nicht umgestellt werden.", 403);
  return driver;
}
