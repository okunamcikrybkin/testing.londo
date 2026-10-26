import { type NextRequest } from "next/server";
import { api } from "@/lib/roulette/api";
import { saveSettings } from "@/lib/roulette/admin";
export async function PATCH(request: NextRequest) { return api(request, true, async user => saveSettings(user, await request.json())); }
