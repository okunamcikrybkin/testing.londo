import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeStaffNext } from "./policy";
export async function requireStaffPagePin(next = "/dashboard") {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.pinRequired) redirect(`/access/pin/${user.pinConfigured ? "verify" : "setup"}?next=${encodeURIComponent(safeStaffNext(next))}`);
  return user;
}
