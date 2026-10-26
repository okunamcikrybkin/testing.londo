import {Suspense} from "react";
import {redirect} from "next/navigation";
import {Header} from "@/components/header";
import {canManageApplications,getApplicationStaffUser} from "@/lib/applications/access";
import {PromotionsClient} from "@/components/promotions-client";
import {FamilySettingsLayout} from "@/components/family-settings-layout";
export async function PromotionsPage({family,admin=false}:{family:"MEMPHIS";admin?:boolean}){
 const user=await getApplicationStaffUser(admin?undefined:family);if(!user)redirect("/dashboard");
 const availableFamilies=( ["MEMPHIS"] as const).filter(item=>admin||canManageApplications(user,item));
 return <div className="londo-page min-h-screen"><Header user={user}/><main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10 sm:px-6">{admin&&<FamilySettingsLayout access={user.effectiveAccess} pathname="/promotions/admin"/>}<Suspense fallback={<p className="py-10 text-muted">Загрузка повышений…</p>}><PromotionsClient key={`${family}:${admin}`} family={family} admin={admin} availableFamilies={availableFamilies}/></Suspense></main></div>;
}
