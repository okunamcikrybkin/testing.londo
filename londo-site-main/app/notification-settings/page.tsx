import {redirect} from "next/navigation";
import {Header} from "@/components/header";
import {getFeatureUser} from "@/lib/permissions/guards";
import {NotificationSettingsClient} from "@/components/notification-settings-client";
import {FamilySettingsLayout} from "@/components/family-settings-layout";
export const dynamic="force-dynamic";
export default async function Page(){const user=await getFeatureUser("notifications");if(!user)redirect("/dashboard");return <div className="londo-page min-h-screen"><Header user={user}/><FamilySettingsLayout access={user.effectiveAccess} pathname="/notification-settings"/><main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:px-6"><NotificationSettingsClient/></main></div>;}
