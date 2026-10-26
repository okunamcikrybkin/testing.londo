import { NextResponse } from "next/server";
import { getGiveawayManager } from "@/lib/giveaways/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const TIMEOUT_MS = 5_000;

export async function GET() {
  if (!await getGiveawayManager()) return NextResponse.json({ error: "Forbidden." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const base = process.env.LONDO_BOT_INTERNAL_URL?.trim(); const secret = process.env.LONDO_BOT_API_SECRET?.trim();
  if (!base || !secret) return NextResponse.json({ error: "Bot unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(new URL("/internal/discord/giveaway-options", base), { cache: "no-store", headers: { "x-londo-bot-secret": secret }, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || typeof body !== "object") throw new Error("Bot unavailable.");
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Bot unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  finally { clearTimeout(timeout); }
}
