import type { NextRequest } from "next/server";
import { botAuthorized, noStore, unauthorized } from "@/lib/giveaways/internal";
import { finishGiveaway, publicGiveaway } from "@/lib/giveaways/data";
export const dynamic = "force-dynamic"; export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, { params }: Context) {
  if (!botAuthorized(request)) return unauthorized();
  try {
    const result = await finishGiveaway((await params).id);
    return noStore({ finished: result.finished, giveaway: publicGiveaway(result.giveaway) });
  } catch (error) {
    return noStore({ ok: false, code: error instanceof Error && error.message === "NOT_FOUND" ? "NOT_FOUND" : "FINISH_FAILED" }, 400);
  }
}
