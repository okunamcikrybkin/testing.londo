import { type NextRequest } from "next/server";
import { api } from "@/lib/roulette/api";
import { savePrize } from "@/lib/roulette/admin";
export async function POST(request: NextRequest) { return api(request, true, async user => savePrize(user, null, await request.json())); }
