import { NextResponse, type NextRequest } from "next/server";
import { botAuthorized } from "@/lib/giveaways/internal";
import { createFamilyApplication, isActiveApplicationConflict, parseApplicationIntake } from "@/lib/applications/intake";

export async function POST(request: NextRequest) {
  if (!botAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const application = await createFamilyApplication(parseApplicationIntake(await request.json()));
    return NextResponse.json({ id: application.id, status: application.status }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (isActiveApplicationConflict(error)) return NextResponse.json({ error: "У пользователя уже есть активная заявка." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Некорректная заявка." }, { status: 400 });
  }
}
