import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Необходимо войти через Discord." }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const profile = await prisma.voiceProfile.findUnique({
    where: { discordUserId: user.discordId },
    select: { balance: true },
  });

  return NextResponse.json({ balance: profile?.balance.toString() ?? "0" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
