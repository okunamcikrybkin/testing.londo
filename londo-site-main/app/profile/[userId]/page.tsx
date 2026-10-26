import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { ProfileView } from "@/components/profile/profile-view";
import { shopBot } from "@/lib/shop/bot";
import { getCurrentUser } from "@/lib/auth/session";
import { readCustomization, readPublicDiscordProfile } from "@/lib/profile-customization/service";
import { profileProjection } from "@/lib/profile-customization/settings";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId)) notFound();
  const viewer = await getCurrentUser();
  const isDiscordId = /^\d{16,22}$/.test(userId);
  const data = await (isDiscordId ? readPublicDiscordProfile(userId) : readCustomization(userId)).catch(() => null);
  if (!data) notFound();
  const visible = profileProjection(data.profile, data.settings);
  const discordMember = data.settings.showRank && data.profile.discordId
    ? await shopBot<{ status: string; roleNames?: Record<string, string> }>("/internal/discord/applications/member-roles", { discordId: data.profile.discordId }).catch(() => null)
    : null;
  const discordRoles = discordMember?.status === "MEMBER" ? Object.values(discordMember.roleNames ?? {}).filter((role) => typeof role === "string") : [];
  const ownProfile = viewer?.discordId === data.profile.discordId;

  return <div className="londo-page min-h-screen"><Header user={viewer} /><main className="mx-auto w-full min-w-0 max-w-[1240px] px-4 py-10 sm:px-6">
    <h1 className="sr-only">Профиль {visible.profile.displayName}</h1>
    {ownProfile && <Link href="/profile/customize" className="londo-button mb-5 inline-flex px-4 py-2">Настроить профиль</Link>}
    <ProfileView {...visible} discordRoles={discordRoles} />
  </main></div>;
}
