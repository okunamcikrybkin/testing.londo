import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canManage } from "@/lib/roulette/rules";
import { FamilySettingsLayout } from "@/components/family-settings-layout";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user=await getCurrentUser();
  if (!user || !canManage(user)) redirect("/roulette");
  return <><FamilySettingsLayout access={user.effectiveAccess} pathname="/roulette/admin"/><nav className="mb-7 mt-7 flex flex-wrap gap-2" aria-label="Разделы управления рулеткой"><Link href="/roulette/admin" className="londo-button-ghost px-4 py-2">Настройки и призы</Link><Link href="/roulette/admin/history" className="londo-button-ghost px-4 py-2">История вращений</Link><Link href="/roulette" className="londo-button-ghost px-4 py-2">← Страница рулетки</Link></nav>{children}</>;
}
