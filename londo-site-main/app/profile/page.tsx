import Link from "next/link";
import {redirect} from "next/navigation";
import {Header} from "@/components/header";
import {getCurrentUser} from "@/lib/auth/session";
import {ACCESS_LABELS} from "@/lib/permissions/rbac";
import {readCustomization} from "@/lib/profile-customization/service";
import {profileProjection} from "@/lib/profile-customization/settings";
import {ProfileView} from "@/components/profile/profile-view";
import {shopBot} from "@/lib/shop/bot";
export const dynamic="force-dynamic";
export default async function ProfilePage(){const user=await getCurrentUser();if(!user)redirect("/");const [data,discordMember]=await Promise.all([readCustomization(user.id),shopBot<{status:string;roleNames?:Record<string,string>}>("/internal/discord/applications/member-roles",{discordId:user.discordId}).catch(()=>null)]),visible=profileProjection(data.profile,data.settings,true),discordRoles=discordMember?.status==="MEMBER"?Object.values(discordMember.roleNames??{}).filter(role=>typeof role==="string"):[];return <div className="londo-page min-h-screen" data-ui-page="profile"><Header user={user}/><main className="mx-auto w-full min-w-0 max-w-[1240px] px-4 py-10 sm:px-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">Мой профиль</h1></div><ProfileView {...visible} discordRoles={discordRoles} owner/><Link href={`/profile/${user.id}`} className="mt-5 inline-block text-sm text-accent">Посмотреть, как профиль видят другие ↗</Link><section className="londo-card mt-6 rounded-3xl p-5"><h2 className="mb-4 text-sm text-muted">Данные аккаунта · видны только вам</h2><dl className="space-y-3 text-sm">{[["Discord ID",user.discordId],["Доступ",ACCESS_LABELS[user.effectiveAccess]],["Дата регистрации",new Intl.DateTimeFormat("ru-RU",{dateStyle:"long"}).format(user.createdAt)]].map(([label,value])=><div key={label} className="flex flex-wrap justify-between gap-3"><dt className="text-muted">{label}</dt><dd className="break-all">{value}</dd></div>)}</dl></section></main></div>;}
