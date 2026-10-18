"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/guards";
import { saveRewardDraft } from "@/server/services/ranks";
import { formAction, type FormState } from "@/server/actions/form-state";
export type DraftState = FormState & { updatedAt?: string };
export async function saveDraftAction(previous: DraftState, form: FormData): Promise<DraftState> {
  let updatedAt: string | undefined;
  const result = await formAction(async () => {
    const { user } = await requireAdmin();
    updatedAt = await saveRewardDraft(user, { threshold: Number(form.get("threshold")), contentDraft: String(form.get("contentDraft") ?? ""), conditionsDraft: String(form.get("conditionsDraft") ?? ""), reason: String(form.get("reason") ?? ""), updatedAt: String(form.get("updatedAt") ?? "") || null });
    revalidatePath("/admin/raenge");
    return { saved: true };
  });
  // Advance this form's revision only after its own successful write, not after unrelated revalidation.
  return { ...result, updatedAt: result.saved ? updatedAt : previous.updatedAt };
}
