import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { PromotionApplyClient } from "@/components/promotions/apply-client";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PromotionApplyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <div className="londo-page min-h-screen"><Header user={user} /><main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6"><PromotionApplyClient /></main></div>;
}
