import { type NextRequest } from "next/server";
import { api } from "@/lib/roulette/api";
import { playerState } from "@/lib/roulette/data";
export async function GET(request: NextRequest) { return api(request, false, playerState); }
