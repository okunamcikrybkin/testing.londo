import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { noStore, unauthorized } from "@/lib/giveaways/internal";
import * as service from "@/lib/promotions/service";
import { familyOf, object, str } from "@/lib/promotions/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    return noStore(await service.userCatalog(user.discordId));
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Не удалось загрузить форму." }, 400);
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && new URL(origin).host !== request.headers.get("host"))) return noStore({ error: "Запрос отклонён." }, 403);
    if (!request.headers.get("content-type")?.includes("application/json")) return noStore({ error: "Ожидается JSON." }, 400);
    const value = object(await request.json());
    const result = await service.submit({ ...value, family: familyOf(value.family), rankId: str(value.rankId, 64, 1), requestKey: randomUUID(), discordUserId: user.discordId });
    return noStore({ ok: true, applicationId: result.id });
  } catch (error) {
    return noStore({ error: error instanceof Error ? error.message : "Не удалось отправить заявку." }, 400);
  }
}
