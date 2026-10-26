import { type NextRequest } from "next/server";
import { api } from "@/lib/roulette/api";
import { savePrize, deletePrize } from "@/lib/roulette/admin";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, ctx: Context) { return api(request, true, async user => savePrize(user, (await ctx.params).id, await request.json())); }
export async function DELETE(request: NextRequest, ctx: Context) { return api(request, true, async user => deletePrize(user, (await ctx.params).id)); }
