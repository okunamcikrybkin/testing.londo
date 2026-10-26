import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getCurrentUser } from "@/lib/auth/session";
import "./roulette.css";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/discord?next=/roulette");
  return <div className="londo-page min-h-screen"><Header user={user}/><main className="roulette-page mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main></div>;
}
