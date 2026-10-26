import { canUseFeature } from "@/lib/permissions/features";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect(canUseFeature(user.effectiveAccess, "dashboard") ? "/dashboard" : "/profile");
  }
  redirect("/about");
}
