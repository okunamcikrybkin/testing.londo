import { NextResponse, type NextRequest } from "next/server";
import {
  handleDiscordApplicationInteraction,
  isValidDiscordInteraction,
} from "@/lib/discord/application-form";

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!isValidDiscordInteraction(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return await handleDiscordApplicationInteraction(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Invalid interaction." }, { status: 400 });
  }
}
