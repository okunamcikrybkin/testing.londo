"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { parseBirthdayDate, safeBirthdayReturnPath } from "@/lib/profile/birthday";

export async function saveBirthday(formData: FormData): Promise<void> {
  const user = await getCurrentUser({ allowIncompleteBirthday: true });
  if (!user) redirect("/");

  const next = safeBirthdayReturnPath(typeof formData.get("next") === "string" ? String(formData.get("next")) : null);
  const birthday = parseBirthdayDate(formData.get("birthday"));
  if (!birthday) redirect(`/profile/birthday?error=invalid&next=${encodeURIComponent(next)}`);

  await prisma.user.updateMany({
    where: { id: user.id, birthdayYear: null },
    data: { birthdayMonth: birthday.month, birthdayDay: birthday.day, birthdayYear: birthday.year },
  });
  redirect(next);
}
