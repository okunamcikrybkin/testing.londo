import { type NextRequest } from "next/server";
import { api } from "@/lib/roulette/api";
import { spin } from "@/lib/roulette/service";
import { deliverRole } from "@/lib/roulette/delivery";
export async function POST(request: NextRequest) {
  return api(request, false, async user => {
    const result = await spin(user, await request.json());
    const settled = result.status === "PENDING_DELIVERY" ? await deliverRole(result.id) : result;
    return { spin: settled, winningPrizeId: settled.prizeId, wheel: settled.wheelSnapshot };
  });
}
