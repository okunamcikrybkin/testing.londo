import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/roulette/rules";
import { serialize } from "@/lib/roulette/data";
import { PrizeForm } from "../../forms";
export default async function Page({params}:{params:Promise<{id:string}>}){requireAdmin(await getCurrentUser());const prize=await prisma.roulettePrize.findFirst({where:{id:(await params).id,deletedAt:null}});if(!prize)notFound();return <><Link href="/roulette/admin" className="inline-flex text-sm text-muted transition hover:text-white">← Вернуться к наградам</Link><h1 className="mb-2 mt-6 text-3xl font-semibold text-white">Изменить награду</h1><p className="mb-7 text-sm text-muted">{prize.name}</p><PrizeForm prize={serialize(prize)}/></>;}
