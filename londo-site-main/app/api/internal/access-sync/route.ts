import { prisma } from "@/lib/db/prisma";
import { accessSyncAuthorized, parseAccessObservation } from "@/lib/access/protocol";
import { syncDiscordAccess } from "@/lib/access/sync";
export const runtime = "nodejs";
const authorized = (r: Request) => accessSyncAuthorized(r.headers.get("x-londo-bot-secret"), process.env.LONDO_BOT_API_SECRET);
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const users = await prisma.user.findMany({ select: { discordId: true } });
  return Response.json({ discordIds: users.map(user => user.discordId) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let observations;
  try {
    const text = await request.text();
    if (text.length > 100_000) throw new Error("TOO_LARGE");
    const body: unknown = JSON.parse(text);
    const entries = Array.isArray(body) ? body : [body];
    if (!entries.length || entries.length > 100) throw new Error("INVALID_BATCH");
    // Validate the entire batch before making any writes.
    observations = entries.map(entry => parseAccessObservation(entry));
  } catch { return Response.json({ error: "Invalid or stale observation" }, { status: 400 }); }
  try {
    const results = [];
    for (const observation of observations) results.push(await syncDiscordAccess(observation));
    return Response.json({ results });
  } catch { return Response.json({ error: "Sync temporarily unavailable" }, { status: 503 }); }
}
