import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth/session";
import { canManageFactionRoles } from "@/lib/faction-roles/validation";
import { FactionRolesClient } from "@/components/faction-roles-client";
import { FamilySettingsLayout } from "@/components/family-settings-layout";
export const dynamic="force-dynamic";
export default async function Page(){const user=await getCurrentUser();if(!user||!canManageFactionRoles(user.effectiveAccess))redirect("/dashboard");return <div className="londo-page min-h-screen"><Header user={user}/><FamilySettingsLayout access={user.effectiveAccess} pathname="/faction-roles"/><main className="mx-auto w-full min-w-0 max-w-[1184px] px-4 pb-16 pt-7 sm:px-6 lg:px-8"><FactionRolesClient/></main></div>;}
