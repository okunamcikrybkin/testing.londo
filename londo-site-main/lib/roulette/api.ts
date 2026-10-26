import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../auth/session";
import { requireAdmin, requirePlayer, RouletteError, type Actor } from "./rules";
export async function api(request: NextRequest, admin: boolean, action: (user: Actor) => Promise<unknown>) {
  try {
    const user = await getCurrentUser();
    if (admin) requireAdmin(user); else requirePlayer(user);
    if (request.method !== "GET") {
      const origin = request.headers.get("origin");
      if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && new URL(origin).host !== request.headers.get("host"))) throw new RouletteError("FORBIDDEN", "Запрос отклонён.", 403);
      if (!request.headers.get("content-type")?.includes("application/json")) throw new RouletteError("INVALID_INPUT", "Ожидается JSON.");
    }
    return NextResponse.json(await action(user), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ code: e instanceof RouletteError ? e.code : "UNAVAILABLE", error: e instanceof RouletteError ? e.message : "Не удалось выполнить запрос. Попробуйте ещё раз." }, { status: e instanceof RouletteError ? e.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
