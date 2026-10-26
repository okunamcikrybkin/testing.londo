"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { hashSessionToken, SESSION_COOKIE } from "@/lib/auth/discord";
import { prisma } from "@/lib/db/prisma";
import { AccessError, createStaffRequest, reviewStaffRequest } from "./service";
import type { AccessActionState } from "./action-state";
async function run(operation: (id: string) => Promise<{ message: string }>): Promise<AccessActionState> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const session = token ? await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) }, select: { id: true } }) : null;
    if (!session) throw new AccessError("Войдите в аккаунт.", 401);
    const result = await operation(session.id); revalidatePath("/access"); return { ok: true, message: result.message };
  } catch (e) { return { ok: false, message: e instanceof AccessError ? e.message : "Не удалось выполнить действие." }; }
}
export async function createAccessRequest(): Promise<AccessActionState> { return run(createStaffRequest); }
export async function approveAccessRequest(_: AccessActionState, form: FormData): Promise<AccessActionState> { return run(id => reviewStaffRequest(id, String(form.get("requestId") ?? ""), true)); }
export async function rejectAccessRequest(_: AccessActionState, form: FormData): Promise<AccessActionState> { return run(id => reviewStaffRequest(id, String(form.get("requestId") ?? ""), false, String(form.get("reason") ?? ""))); }
