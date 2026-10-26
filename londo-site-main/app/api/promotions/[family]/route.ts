import { type NextRequest } from "next/server";
import { getApplicationStaffUser } from "@/lib/applications/access";
import { prisma } from "@/lib/db/prisma";
import { noStore, unauthorized } from "@/lib/giveaways/internal";
import * as service from "@/lib/promotions/service";
import { familyOf, object, str } from "@/lib/promotions/validation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ family: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const family = familyOf((await context.params).family.toUpperCase());
    const mode = request.nextUrl.searchParams.get("mode");
    const user = await getApplicationStaffUser(mode === "options" ? undefined : family);
    if (!user) return unauthorized();

    await service.ensureSettings();
    if (mode === "options") return noStore(await service.options(family));
    const rankId = request.nextUrl.searchParams.get("rank") || undefined;
    const discordUserId = request.nextUrl.searchParams.get("user") || undefined;
    const cursor = request.nextUrl.searchParams.get("cursor") || undefined;
    const applications = await prisma.promotionApplication.findMany({
      where: { family, rankId, discordUserId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 201,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return noStore({
      nextCursor: applications.length > 200 ? applications[199].id : null,
      settings: await prisma.promotionSettings.findUnique({ where: { family } }),
      ranks: await prisma.promotionRank.findMany({
        where: { family, deletedAt: null },
        include: { criteria: { orderBy: { sortOrder: "asc" } }, questions: { orderBy: { sortOrder: "asc" } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      applications: applications.slice(0, 200),
    });
  } catch {
    return noStore({ error: "Не удалось загрузить повышения." }, 400);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && new URL(origin).host !== request.headers.get("host"))) {
      return noStore({ error: "Запрос отклонён." }, 403);
    }
    if (!request.headers.get("content-type")?.includes("application/json")) return noStore({ error: "Ожидается JSON." }, 400);

    const family = familyOf((await context.params).family.toUpperCase());
    const body = object(await request.json());
    const user = await getApplicationStaffUser(body.operation === "review" ? family : undefined);
    if (!user) return unauthorized();

    switch (body.operation) {
      case "settings": return noStore(await service.saveSettings(family, body.value, user.id));
      case "rank": return noStore(await service.saveRank(family, body.id ? str(body.id, 64, 1) : undefined, body.value, user.id));
      case "delete": return noStore(await service.removeRank(family, str(body.id, 64, 1), user.id));
      case "review": return noStore(await service.review(family, str(body.id, 64, 1), body.action, body.reason, { ...user, displayName: user.displayName || user.username }));
      case "refresh": return noStore({ warning: await service.refresh(family) });
      default: return noStore({ error: "Неизвестная операция." }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Операция не выполнена.";
    return noStore({ error: message.includes("prisma") || message.includes("Unique constraint") ? "Данные конфликтуют с существующей записью. Обновите страницу и проверьте роль." : message }, 400);
  }
}
