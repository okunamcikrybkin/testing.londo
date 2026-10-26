import { handleDiscordSignInRequest } from "@/lib/auth/discord";
import type { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  return handleDiscordSignInRequest(request);
}
