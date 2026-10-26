import {redirect} from "next/navigation";
import {Header} from "@/components/header";
import {getCurrentUser} from "@/lib/auth/session";
import {readCustomization} from "@/lib/profile-customization/service";
import {ProfileEditor} from "@/components/profile/profile-editor";
export const dynamic="force-dynamic";
export default async function Page(){const user=await getCurrentUser();if(!user)redirect("/");const data=await readCustomization(user.id);return <div className="londo-page min-h-screen"><Header user={user}/><main className="mx-auto w-full min-w-0 max-w-[1440px] px-4 py-8 sm:px-6 lg:py-12"><ProfileEditor initial={data.settings} profile={data.profile} availableBadges={data.availableBadges} userId={user.id}/></main></div>;}
