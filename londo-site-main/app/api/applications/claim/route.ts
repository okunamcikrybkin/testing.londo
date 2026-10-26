import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canEditFamilyApplication } from "@/lib/applications/edit-policy";
import { familyFromSlug } from "@/lib/applications/families";
import { ApplicationClaimError, claimFamilyApplication } from "@/lib/applications/claim";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
  try {
    const body = await request.json() as { id?: unknown; family?: unknown };
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const family = typeof body.family === "string" ? familyFromSlug(body.family) : null;
    if (!id || !family || !canEditFamilyApplication(user, family)) return NextResponse.json({ error: "Недостаточно прав." }, { status: 403 });
    const application = await claimFamilyApplication(id, family, user.id);
    return NextResponse.json({ ok: true, applicationId: application.id });
  } catch (error) {
    const message = error instanceof ApplicationClaimError ? error.message : "Не удалось закрепить заявку.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
