import { NextResponse } from "next/server";
import { getShopManager } from "@/lib/shop/access";
import { discordOptions } from "@/lib/shop/bot";
export async function GET() { if (!await getShopManager()) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); try { return NextResponse.json(await discordOptions(), { headers: { "Cache-Control": "no-store" } }); } catch { return NextResponse.json({ error: "Discord Bot недоступен." }, { status: 503 }); } }
