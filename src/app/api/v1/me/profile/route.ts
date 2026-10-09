import { z } from "zod";
import { api, readJson } from "@/server/api/handler";
import { parseInput } from "@/server/services/auth";
import { profileSchema, updateDriverProfile, setPhotoPublic, setDriverActive } from "@/server/services/profile";
export const GET = api({ auth: "driver" }, async ({ session }) => {
  const { user: u, driver: d } = session!;
  return { firstName: u.firstName, lastName: u.lastName, email: u.email, emailVerified: Boolean(u.emailVerifiedAt), phone: u.phone,
    nameDisplay: d!.nameDisplay, customName: d!.customName, tagline: d!.tagline, bio: d!.bio, city: d!.city,
    photoPublic: d!.photoPublic, hasPhoto: Boolean(d!.photoKey), active: d!.active, notifyOnTip: d!.notifyOnTip };
});
export const PATCH = api({ auth: "driver", rateLimit: { key: "app-profile", limit: 30, windowMs: 600000 } }, async ({ session, request }) => {
  const input = await readJson(request);
  // Anbieter bleibt V1 unsichtbar. Client darf weder Kontoinhaber noch Stripe-IDs setzen.
  const driver = session!.driver!;
  const active = parseInput(z.boolean(), input.active);
  const photoPublic = parseInput(z.boolean(), input.photoPublic);
  // GET represents absent optional fields as null; the shared form schema uses
  // undefined/empty strings. Permit a native round trip without weakening types.
  const optionalFields = Object.fromEntries(["customName", "tagline", "bio", "city", "phone"].map(key => [key, input[key] === null ? undefined : input[key]]));
  const editable = parseInput(profileSchema, { ...input, ...optionalFields, providerId: driver.providerId ?? undefined, providerPublic: driver.providerPublic });
  await updateDriverProfile(session!.user, driver, { ...editable, providerId: driver.providerId, providerPublic: driver.providerPublic });
  await setPhotoPublic(driver, photoPublic); await setDriverActive(driver, active); return { ok: true };
});
