import { handleDiscordSignOutRequest } from "@/lib/auth/discord";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return handleDiscordSignOutRequest(request);
}
