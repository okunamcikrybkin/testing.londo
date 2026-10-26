import { Header } from "@/components/header";
import { getShopManager } from "@/lib/shop/access";
import { listShops } from "@/lib/shop/data";
import { redirect } from "next/navigation";
import { ShopForm } from "../shop-client";
import { FamilySettingsLayout } from "@/components/family-settings-layout";
export const dynamic = "force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{family?:string}>}){const user=await getShopManager();if(!user)redirect("/dashboard");const shops=await listShops();void params;return <div className="londo-page min-h-screen"><Header user={user}/><FamilySettingsLayout access={user.effectiveAccess} pathname="/shop/settings"/><main className="mx-auto max-w-6xl px-4 py-10"><h1 className="text-3xl font-bold">Настройки магазина</h1><ShopForm shops={JSON.parse(JSON.stringify(shops))} initialFamily={"MEMPHIS"} settings /></main></div>;}
