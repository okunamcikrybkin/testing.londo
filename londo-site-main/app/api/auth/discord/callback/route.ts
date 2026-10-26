import type { NextRequest } from "next/server";
import { handleDiscordCallbackRequest } from "@/lib/auth/discord";

export async function GET(request: NextRequest) {
  return handleDiscordCallbackRequest(request);
}
