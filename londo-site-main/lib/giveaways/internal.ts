import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export function botAuthorized(request: NextRequest): boolean {
  const expected = process.env.LONDO_BOT_API_SECRET;
  const supplied = request.headers.get("x-londo-bot-secret");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export function noStore(body: object, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
