import { Header } from "@/components/header";
import { GiveawayForm } from "@/components/giveaways/giveaway-form";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageGiveaways } from "@/lib/giveaways/access";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FamilySettingsLayout } from "@/components/family-settings-layout";
export default async function NewGiveawayPage() { const user = await getCurrentUser(); if (!user || !canManageGiveaways(user)) redirect("/giveaways"); return <div className="londo-page min-h-screen"><Header user={user} /><FamilySettingsLayout access={user.effectiveAccess} pathname="/giveaways/new"/><main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6"><Link href="/giveaways" className="text-sm text-muted transition hover:text-white">← Вернуться к списку розыгрышей</Link><p className="londo-eyebrow mt-7">Розыгрыши</p><h1 className="mt-3 text-3xl font-bold text-white">Создать розыгрыш</h1><p className="mt-3 text-muted">Публикация произойдёт только после отдельного запуска.</p><div className="mt-8"><GiveawayForm /></div></main></div>; }
