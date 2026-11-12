/** Only these senior roles may update a FAM member's server nickname themselves. */
export const NICKNAME_GUARD_EXEMPT_ROLE_IDS = new Set(
  (process.env.NICKNAME_GUARD_EXEMPT_ROLE_IDS ?? "").split(",").map(value => value.trim()).filter(value => /^\d{17,20}$/.test(value)),
);

export function hasNicknameGuardExemption(roleIds: Iterable<string>): boolean {
  const available = new Set(roleIds);
  return [...NICKNAME_GUARD_EXEMPT_ROLE_IDS].some((roleId) => available.has(roleId));
}
