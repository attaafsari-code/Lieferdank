"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCustomer } from "../guards";
import { destroySession, getSession } from "../session";
import { enableDriver } from "../services/roles";
import { enforceRateLimit } from "../rate-limit";
import { removeFavorite, renameFavorite } from "../services/favorites";
import { deleteAccount } from "../services/profile";
import { formAction, type FormState } from "./form-state";

export async function removeFavoriteAction(favoriteId: string): Promise<FormState> {
  return formAction(async () => {
    const { user } = await requireCustomer();
    await removeFavorite(user.id, favoriteId);
    revalidatePath("/konto");
  });
}

export async function renameFavoriteAction(favoriteId: string, nickname: string): Promise<FormState> {
  return formAction(async () => {
    const { user } = await requireCustomer();
    await renameFavorite(user.id, favoriteId, nickname);
    revalidatePath("/konto");
  });
}

export async function deleteCustomerAccountAction(): Promise<void> {
  const { user } = await requireCustomer();
  await deleteAccount(user);
  await destroySession();
  redirect("/?geloescht=1");
}

export async function enableDriverAction(_prev: FormState, form: FormData): Promise<FormState> {
  return formAction(async () => {
    await enforceRateLimit("enable-driver", 5, 600000);
    const session = await getSession();
    if (!session) redirect("/login");
    await enableDriver(session.user, { firstName: form.get("firstName"), lastName: form.get("lastName"), acceptedTerms: form.get("acceptedTerms") === "on" });
    redirect("/dashboard");
  });
}
