import {redirect} from "next/navigation";
import {Header} from "@/components/header";
import {getCurrentUser} from "@/lib/auth/session";
import {canManageRankColors} from "@/lib/rank-appearance/rules";
import {getRankColors} from "@/lib/rank-appearance/service";
import {RankColorsEditor} from "./editor";
import {FamilySettingsLayout} from "@/components/family-settings-layout";
export const dynamic="force-dynamic";
export default async function Page(){const user=await getCurrentUser();if(!canManageRankColors(user))redirect("/dashboard");return <div className="londo-page min-h-screen"><Header user={user}/><FamilySettingsLayout access={user?.effectiveAccess??""} pathname="/settings/rank-colors"/><main className="mx-auto max-w-3xl px-4 py-10"><p className="londo-eyebrow">Для администрации</p><h1 className="mt-3 text-3xl font-bold">Цвета рангов</h1><p className="mb-7 mt-3 text-sm text-muted">Единые цвета рангов на сайте LONDO.</p><RankColorsEditor initial={await getRankColors()}/></main></div>;}
