import {Header} from "@/components/header";
import {requireFeaturePage} from "@/lib/permissions/guards";
import {Watchlist} from "@/components/discord-checks/watchlist";
import s from "@/components/discord-checks/ui.module.css";
import {FamilySettingsLayout} from "@/components/family-settings-layout";
export default async function WatchlistPage(){const user=await requireFeaturePage("discordChecks");return <div className="londo-page min-h-screen"><Header user={user}/><FamilySettingsLayout access={user.effectiveAccess} pathname="/settings/discord-checks"/><main className={s.adminPage}><header className="londo-admin-heading"><p className="londo-admin-eyebrow">Панель администратора · Участники</p><h1 className="londo-admin-title">Проверка Discord</h1><p className="londo-admin-description">Управляйте серверами, на которых проверяется присутствие участника перед подачей заявки.</p></header><Watchlist/></main></div>;}
