import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageEconomy } from "@/lib/economy/rules";
import { EconomyClient } from "./client";
import {FamilySettingsLayout} from "@/components/family-settings-layout";
export const dynamic="force-dynamic";
export default async function Page(){const user=await getCurrentUser();if(!canManageEconomy(user))redirect("/dashboard");return <div className="londo-page min-h-screen"><Header user={user}/><FamilySettingsLayout access={user?.effectiveAccess??""} pathname="/economy"/><main className="mx-auto max-w-6xl px-4 py-10"><p className="londo-eyebrow">Панель администратора</p><h1 className="mb-8 mt-3 text-3xl font-bold">Управление монетами</h1><EconomyClient/></main></div>;}
