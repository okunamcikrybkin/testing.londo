import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";

function authorized(request: NextRequest): boolean {
  const expected = process.env.LONDO_BOT_API_SECRET;
  const value = request.headers.get("x-londo-bot-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !value) return false;
  const expectedBuffer = Buffer.from(expected);
  const valueBuffer = Buffer.from(value);
  return expectedBuffer.length === valueBuffer.length && timingSafeEqual(expectedBuffer, valueBuffer);
}

export async function GET(request: NextRequest) {
  if (!process.env.LONDO_BOT_API_SECRET) return NextResponse.json({ error: "Birthday sync is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const month = Number(request.nextUrl.searchParams.get("month"));
  const day = Number(request.nextUrl.searchParams.get("day"));
  const year = Number(request.nextUrl.searchParams.get("year"));
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(year) || year < 2000 || year > new Date().getUTCFullYear() + 1) {
    return NextResponse.json({ error: "Invalid date." }, { status: 400 });
  }

  const [users, activeRoleGrants] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE", birthdayMonth: month, birthdayDay: day, birthdayYear: { not: null } },
      select: { discordId: true, birthdayLastCelebratedYear: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { birthdayRoleGrantedAt: { not: null } },
      select: { discordId: true, birthdayRoleGrantedAt: true },
    }),
  ]);
  return NextResponse.json({ users, activeRoleGrants }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!process.env.LONDO_BOT_API_SECRET) return NextResponse.json({ error: "Birthday sync is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.text();
  if (body.length > 4096) return NextResponse.json({ error: "Payload is too large." }, { status: 413 });
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  const data = payload as Record<string, unknown>;
  const action = data.action;
  const discordId = data.discordId;
  if (typeof discordId !== "string" || !/^\d{16,22}$/.test(discordId)) return NextResponse.json({ error: "Invalid Discord ID." }, { status: 400 });

  let updated;
  if (action === "CELEBRATED") {
    const year = data.year;
    if (typeof year !== "number" || !Number.isInteger(year) || year < 2000 || year > new Date().getUTCFullYear() + 1) return NextResponse.json({ error: "Invalid birthday year." }, { status: 400 });
    updated = await prisma.user.updateMany({
      where: { discordId, birthdayMonth: { not: null }, birthdayDay: { not: null }, birthdayYear: { not: null } },
      data: { birthdayLastCelebratedYear: year },
    });
  } else if (action === "ROLE_GRANTED") {
    const grantedAt = typeof data.grantedAt === "string" ? new Date(data.grantedAt) : null;
    if (!grantedAt || Number.isNaN(grantedAt.valueOf()) || grantedAt > new Date(Date.now() + 5 * 60 * 1000)) return NextResponse.json({ error: "Invalid role grant time." }, { status: 400 });
    updated = await prisma.user.updateMany({ where: { discordId, birthdayMonth: { not: null }, birthdayDay: { not: null }, birthdayYear: { not: null } }, data: { birthdayRoleGrantedAt: grantedAt } });
  } else if (action === "ROLE_REMOVED") {
    updated = await prisma.user.updateMany({ where: { discordId }, data: { birthdayRoleGrantedAt: null } });
  } else {
    return NextResponse.json({ error: "Unsupported birthday action." }, { status: 400 });
  }
  if (!updated.count) return NextResponse.json({ error: "Birthday profile not found." }, { status: 404 });
  return NextResponse.json({ updated: true });
}
