import { NextResponse, type NextRequest } from "next/server";
import { getShopManager } from "@/lib/shop/access";
import { refreshShop } from "@/lib/shop/bot";
import { parseFamily } from "@/lib/shop/validation";
export async function POST(request: NextRequest) { if (!await getShopManager()) return NextResponse.json({ error: "Forbidden" }, { status: 403 }); try { const warning = await refreshShop(parseFamily((await request.json()).family)); return NextResponse.json({ warning }, { status: warning ? 503 : 200 }); } catch { return NextResponse.json({ error: "Invalid family" }, { status: 400 }); } }
