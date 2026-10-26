import { type NextRequest } from "next/server";
import { economyApi } from "@/lib/economy/api";
import { searchUsers } from "@/lib/economy/data";
export async function GET(request:NextRequest){return economyApi(request,actor=>searchUsers(actor,request.nextUrl.searchParams.get("q")||""));}
