import { type NextRequest } from "next/server";
import { economyApi } from "@/lib/economy/api";
import { manualHistory } from "@/lib/economy/data";
export async function GET(request:NextRequest){return economyApi(request,actor=>manualHistory(actor,request.nextUrl.searchParams));}
