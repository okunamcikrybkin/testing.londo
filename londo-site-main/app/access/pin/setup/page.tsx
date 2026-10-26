import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { StaffPinForm } from "@/components/access/staff-access-controls";
import { getCurrentUser } from "@/lib/auth/session";
import { safeStaffNext } from "@/lib/access/policy";
import { ACCESS_LABELS } from "@/lib/permissions/rbac";
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser(); if (!user) redirect("/");
  const next = safeStaffNext((await searchParams).next);
  if (user.effectiveAccess === "FULL_ACCESS" || user.approvedRole === "USER") redirect("/access");
  if (user.pinVerified) redirect(next);
  const setup = true;
  if (setup === Boolean(user.pinConfigured)) redirect(`/access/pin/${user.pinConfigured ? "verify" : "setup"}?next=${encodeURIComponent(next)}`);
  return <div className="londo-page min-h-screen"><Header user={user} /><main className="mx-auto max-w-md px-4 py-14"><section className="londo-card rounded-3xl p-6 sm:p-8"><p className="londo-eyebrow">Защита аккаунта</p><h1 className="mt-3 text-2xl font-semibold">{setup ? "Создайте защитный код" : "Подтвердите доступ"}</h1><p className="mt-4">{user.displayName}</p><p className="text-sm text-muted">{ACCESS_LABELS[user.approvedRole ?? "USER"]}</p><StaffPinForm setup={setup} next={next} /></section></main></div>;
}
