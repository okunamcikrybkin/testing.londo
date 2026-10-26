import { cookies } from "next/headers";
import { hashSessionToken, SESSION_COOKIE } from "@/lib/auth/discord";
import { prisma } from "@/lib/db/prisma";
import { AccessError, cancelStaffRequest, createStaffRequest, resetStaffPin, reviewStaffRequest, revokeStaffAccess, setupStaffPin, verifyStaffPin } from "@/lib/access/service";
import { safeStaffNext } from "@/lib/access/policy";
export const runtime = "nodejs";
const response = (value: object, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return response({ error: "Запрос отклонён." }, 403);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) }, select: { id: true } }) : null;
  if (!session) return response({ error: "Войдите в аккаунт." }, 401);
  try {
    const text = await request.text(); if (text.length > 5000) throw new AccessError("Слишком большой запрос.");
    const body = JSON.parse(text) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AccessError("Некорректный запрос.");
    const id = (value: unknown) => { if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)) throw new AccessError("Некорректный ID."); return value; };
    let result;
    switch (body.action) {
      case "REQUEST": if (Object.keys(body).length !== 1) throw new AccessError("Уровень вычисляется сервером."); result = await createStaffRequest(session.id); break;
      case "CANCEL": result = await cancelStaffRequest(session.id); break;
      case "APPROVE": result = await reviewStaffRequest(session.id, id(body.requestId), true); break;
      case "REJECT": result = await reviewStaffRequest(session.id, id(body.requestId), false, typeof body.reason === "string" ? body.reason : undefined); break;
      case "REVOKE": result = await revokeStaffAccess(session.id, id(body.userId)); break;
      case "RESET_PIN": result = await resetStaffPin(session.id, id(body.userId)); break;
      case "PIN_SETUP": result = await setupStaffPin(session.id, body.pin, body.confirmation); break;
      case "PIN_VERIFY": result = await verifyStaffPin(session.id, body.pin); break;
      default: throw new AccessError("Неизвестное действие.");
    }
    if ("error" in result) return response({ error: result.error }, result.status);
    return response({ ...result, ...(body.action === "PIN_SETUP" || body.action === "PIN_VERIFY" ? { next: safeStaffNext(body.next) } : {}) });
  } catch (error) {
    return response({ error: error instanceof AccessError ? error.message : "Не удалось выполнить действие. Попробуйте позже." }, error instanceof AccessError ? error.status : 503);
  }
}
