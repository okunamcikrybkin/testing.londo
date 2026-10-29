type GameIdentity = { gameNickname: string | null; staticId: string | null };
type ProfileIdentity = { customGameNickname: string | null; customStaticId: string | null };

export function rosterIdentity(identity: GameIdentity, customization?: ProfileIdentity): GameIdentity {
  return {
    gameNickname: customization?.customGameNickname?.trim() || identity.gameNickname,
    staticId: customization?.customStaticId?.trim() || identity.staticId,
  };
}
