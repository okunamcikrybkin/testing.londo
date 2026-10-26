import { type NextRequest } from "next/server";
import { api } from "@/lib/roulette/api";
import { completeManual } from "@/lib/roulette/service";
import { deliverRole } from "@/lib/roulette/delivery";
import { RouletteError } from "@/lib/roulette/rules";
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return api(request, true, async user => {
    const { id } = await ctx.params, b = await request.json();
    if (b.action === "complete") return completeManual(user, id);
    if (b.action === "retry") return deliverRole(id);
    throw new RouletteError("INVALID_INPUT", "Неизвестное действие.");
  });
}
