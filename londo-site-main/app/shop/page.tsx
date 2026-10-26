import { Header } from "@/components/header";
import { getShopManager } from "@/lib/shop/access";
import { listShops } from "@/lib/shop/data";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import { ShopDashboard } from "./shop-client";
import { FamilySettingsLayout } from "@/components/family-settings-layout";
export const dynamic = "force-dynamic";
export default async function ShopPage(){const user=await getShopManager();if(!user)redirect("/dashboard");const shops=await listShops();const enriched=await Promise.all(shops.map(async shop=>({...shop,purchaseCount:await prisma.shopPurchase.count({where:{family:shop.family}}),pendingCount:await prisma.shopPurchase.count({where:{family:shop.family,status:"PENDING_FULFILLMENT"}})})));return <div className="londo-page min-h-screen"><Header user={user}/><FamilySettingsLayout access={user.effectiveAccess} pathname="/shop"/><main className="mx-auto max-w-6xl px-4 py-10"><h1 className="text-3xl font-bold">Магазин семьи</h1><ShopDashboard shops={JSON.parse(JSON.stringify(enriched))}/></main></div>;}
