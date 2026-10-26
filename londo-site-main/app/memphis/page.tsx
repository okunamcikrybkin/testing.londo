import { FamilySpace } from "@/components/family-space";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessFamilySpace } from "@/lib/families/access";
import { getFamilyRosterStats } from "@/lib/roster/data";
import { redirect } from "next/navigation";

export default async function MemphisPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!canAccessFamilySpace(user, "MEMPHIS")) redirect("/dashboard");
  const stats = await getFamilyRosterStats("MEMPHIS");
  return <FamilySpace user={user} family="MEMPHIS" applicationsHref="/applications/memphis" stats={stats} />;
}
