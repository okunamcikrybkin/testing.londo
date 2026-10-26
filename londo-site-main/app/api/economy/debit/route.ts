import { type NextRequest } from "next/server";
import { economyApi } from "@/lib/economy/api";
import { adjustCoins } from "@/lib/economy/service";
export async function POST(request:NextRequest){return economyApi(request,async actor=>adjustCoins(actor,"DEBIT",await request.json()));}
