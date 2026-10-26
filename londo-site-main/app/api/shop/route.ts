import { NextResponse } from "next/server";
import { getShopManager } from "@/lib/shop/access";
import { listShops } from "@/lib/shop/data";
export const dynamic = "force-dynamic";
export async function GET() { if (!await getShopManager()) return NextResponse.json({ error: "Forbidden." }, { status: 403 }); return NextResponse.json({ shops: await listShops() }, { headers: { "Cache-Control": "no-store" } }); }
