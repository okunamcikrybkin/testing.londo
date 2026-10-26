"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { familyFromSlug, familySlug } from "./families";
import { ApplicationEditError, editApplicationInTransaction } from "./edit-service";

export async function editApplicationAction(id: string, familyValue: string, input: unknown) {
  const user = await getCurrentUser();
  const family = typeof familyValue === "string" ? familyFromSlug(familyValue) : null;
  if (!family) return { ok: false, message: "Некорректная семья." };
  try {
    const result = await prisma.$transaction(tx => editApplicationInTransaction(tx, user, family, id, input));
    revalidatePath(`/applications/${familySlug(family)}/${id}`);
    revalidatePath(`/applications/${familySlug(family)}`);
    return { ok: true, message: result.changed ? "Изменения сохранены." : "Изменений нет." };
  } catch (error) {
    return { ok: false, message: error instanceof ApplicationEditError ? error.message : "Не удалось сохранить изменения. Попробуйте ещё раз." };
  }
}
