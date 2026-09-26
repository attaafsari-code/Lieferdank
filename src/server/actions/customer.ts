"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCustomer } from "../guards";
import { destroySession } from "../session";
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
