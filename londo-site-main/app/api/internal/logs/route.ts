import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { eventDefinition } from "@/lib/logs/contract";
import { prisma } from "@/lib/db/prisma";
import { LogEventInputError, parseBotLogEvent } from "@/lib/logs/validation";

function authorized(request: NextRequest): boolean {
  const expected = process.env.LONDO_BOT_API_SECRET;
  const value = request.headers.get("x-londo-bot-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !value) return false;
  const expectedBuffer = Buffer.from(expected);
  const valueBuffer = Buffer.from(value);
  return expectedBuffer.length === valueBuffer.length && timingSafeEqual(expectedBuffer, valueBuffer);
}

export async function POST(request: NextRequest) {
  if (!process.env.LONDO_BOT_API_SECRET) return NextResponse.json({ error: "Log intake is not configured." }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.text();
  if (body.length > 32_768) return NextResponse.json({ error: "Payload is too large." }, { status: 413 });
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  try {
    const input = parseBotLogEvent(payload);
    const definition = eventDefinition(input.type);
    const wasOnServerBefore = input.type === "MEMBER_JOINED" && input.target
      ? Boolean(await prisma.logEvent.findFirst({
        where: { source: "LONDO_BOT", type: { in: ["MEMBER_JOINED", "MEMBER_LEFT"] }, targetDiscordId: input.target.discordId, sourceEventId: { not: input.sourceEventId } },
        select: { id: true },
      }))
      : false;
    const membershipName = input.target?.displayName ?? input.target?.username ?? "Участник";
    const summary = input.type === "MEMBER_JOINED"
      ? `${membershipName} ${wasOnServerBefore ? "вернулся на" : "зашёл на"} Discord-сервер.`
      : input.type === "MEMBER_LEFT"
        ? `${membershipName} покинул Discord-сервер.`
        : input.summary;
    const metadata = input.type === "MEMBER_JOINED"
      ? { ...(input.metadata ?? {}), wasOnServerBefore }
      : input.metadata;
    const event = await prisma.logEvent.upsert({
      where: { source_sourceEventId: { source: "LONDO_BOT", sourceEventId: input.sourceEventId } },
      create: { source: "LONDO_BOT", sourceEventId: input.sourceEventId, type: input.type, category: definition.category, action: definition.action, result: input.result, family: input.family, serverId: input.serverId, actorDiscordId: input.actor?.discordId, actorUsername: input.actor?.username, actorDisplayName: input.actor?.displayName, targetDiscordId: input.target?.discordId, targetUsername: input.target?.username, targetDisplayName: input.target?.displayName, discordChannelId: input.discordChannelId, discordMessageId: input.discordMessageId, summary, metadata: metadata as Prisma.InputJsonValue | undefined, createdAt: input.occurredAt ?? undefined },
      update: {},
      select: { id: true },
    });
    return NextResponse.json({ id: event.id, accepted: true }, { status: 201 });
  } catch (error) {
    if (error instanceof LogEventInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Unable to record log event." }, { status: 500 });
  }
}
