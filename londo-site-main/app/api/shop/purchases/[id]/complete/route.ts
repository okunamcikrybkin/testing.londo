import { NextResponse, type NextRequest } from "next/server";
import { getShopManager } from "@/lib/shop/access";
import { completePurchase } from "@/lib/shop/data";
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const user = await getShopManager(); if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 }); try { return NextResponse.json({ purchase: await completePurchase((await params).id, user.id) }); } catch { return NextResponse.json({ error: "Покупка недоступна." }, { status: 409 }); } }
