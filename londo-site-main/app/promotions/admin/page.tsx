import {PromotionsPage} from "@/components/promotions-page";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{family?:string}>}){return <PromotionsPage family={"MEMPHIS"} admin/>;}
