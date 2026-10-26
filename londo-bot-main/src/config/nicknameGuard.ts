/** Only these senior roles may update a FAM member's server nickname themselves. */
export const NICKNAME_GUARD_EXEMPT_ROLE_IDS = new Set([
  "1545123264668369040", // Owner
  "1545453391537242232", // Leader (MEM)
  "1545123264655794265", // Leader (PHX)
]);

export function hasNicknameGuardExemption(roleIds: Iterable<string>): boolean {
  const available = new Set(roleIds);
  return [...NICKNAME_GUARD_EXEMPT_ROLE_IDS].some((roleId) => available.has(roleId));
}
