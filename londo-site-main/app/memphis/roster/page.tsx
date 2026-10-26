import { FamilyRoster } from "@/components/family-roster";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessFamilySpace } from "@/lib/families/access";
import { getFamilyRoster } from "@/lib/roster/data";
import { redirect } from "next/navigation";

export default async function MemphisRosterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!canAccessFamilySpace(user, "MEMPHIS")) redirect("/dashboard");
  return <FamilyRoster user={user} family="MEMPHIS" roster={await getFamilyRoster("MEMPHIS")} />;
}
