import { Header } from "@/components/header";
import { getShopManager } from "@/lib/shop/access";
import { listShops } from "@/lib/shop/data";
import { prisma } from "@/lib/db/prisma";
import { redirect, notFound } from "next/navigation";
import { ShopForm } from "../../shop-client";
import { FamilySettingsLayout } from "@/components/family-settings-layout";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{family?:string}>}){const user=await getShopManager();if(!user)redirect("/dashboard");const shops=await listShops();const item=await prisma.shopItem.findUnique({where:{id:(await params).id,deletedAt:null}});if(!item||item.family!=="MEMPHIS")notFound();return <div className="londo-page min-h-screen"><Header user={user}/><FamilySettingsLayout access={user.effectiveAccess} pathname="/shop/items/[id]"/><main className="mx-auto max-w-6xl px-4 py-10"><Link href="/shop" className="mb-5 inline-flex text-sm text-muted hover:text-white">← Вернуться в магазин</Link><h1 className="text-3xl font-bold">Редактировать товар</h1><ShopForm shops={JSON.parse(JSON.stringify(shops))} initialFamily={"MEMPHIS"} item={JSON.parse(JSON.stringify(item))} /></main></div>;}
