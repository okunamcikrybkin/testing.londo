import { badgeEntitlements, defaultSettings, profileProjection, validateSettings, type ProfileData } from "@/lib/profile-customization/settings";

export const SCENARIOS = { MEMPHIS: "MEMPHIS", PHOENIX: "PHOENIX", BOTH: "Две семьи", PRIVATE: "Скрытые поля", EMPTY: "Пустой профиль" };
export type Scenario = keyof typeof SCENARIOS;

// Entirely fictional fixtures. No session, database or Discord request is made.
export function demoProfile(scenario: Scenario, owner: boolean) {
  const empty = scenario === "EMPTY";
  const families = empty ? [] : scenario === "BOTH" ? ["MEMPHIS", "PHOENIX"] : [scenario === "PHOENIX" ? "PHOENIX" : "MEMPHIS"];
  const availableBadges = badgeEntitlements("MEMBER", families.map(family => ({ family, rankRoleId: "1545123264643473521" })));
  const profile: ProfileData = {
    displayName: empty ? "Новый участник" : "Vofelion", avatarUrl: null,
    username: empty ? "new.member" : "vofelion.demo", gameNickname: empty ? null : "Vofelion Londo",
    staticId: empty ? null : "566", discordId: "100000000000000001",
    families, ranks: families.map(f => `${f} · Main`), coins: "1 250", voiceTime: "42 ч 18 мин", availableBadges,
  };
  const privateMode = scenario === "PRIVATE";
  const settings = validateSettings({
    ...defaultSettings(), theme: scenario === "PHOENIX" ? "RED" : "GOLD", avatarFrame: empty ? "NONE" : "GOLD_RING",
    bannerPreset: empty ? "NONE" : "DEFAULT",
    bio: empty ? "" : "Свои люди, поздние разговоры и город, в который хочется возвращаться. Здесь — моя семья. За её пределами — музыка, стримы и немного Counter-Strike.",
    customStatus: empty ? "" : "Увидимся на улицах города.",
    selectedBadges: availableBadges, games: empty ? [] : ["GTA_V", "CS2", "RUST"], favoriteGame: empty ? null : "GTA_V",
    links: empty ? [] : [
      { type: "TWITCH", label: "Стримы сообщества", url: "https://www.twitch.tv/", enabled: true, sortOrder: 0 },
      { type: "TELEGRAM", label: "На связи", url: "https://telegram.org/", enabled: true, sortOrder: 1 },
      { type: "YOUTUBE", label: "Моменты из города", url: "https://www.youtube.com/", enabled: true, sortOrder: 2 },
    ],
    showCoins: !privateMode && !empty, showVoiceTime: !privateMode && !empty,
    ...(privateMode ? { showDiscordUsername:false, showGameNickname:false, showFamily:false, showRank:false, showGames:false, showSocialLinks:false, showBadges:false } : {}),
  }, availableBadges);
  // Uses the same visibility/entitlement projection as the existing profiles.
  // Client-side switching is safe ONLY because every field here is fictional.
  return profileProjection(profile, settings, owner);
}
