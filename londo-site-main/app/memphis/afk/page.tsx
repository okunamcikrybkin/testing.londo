import { FamilyAfk } from "@/components/family-afk";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{tab?:string;status?:string;user?:string}>}){return <FamilyAfk family="MEMPHIS" query={await searchParams}/>;}
