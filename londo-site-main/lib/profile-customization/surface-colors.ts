import {resolveAccent} from "./colors";
export const DEFAULT_PROFILE_TOP = "#27232F";
export const DEFAULT_PROFILE_BOTTOM = "#141419";
export function normalizeProfileColor(value: unknown, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(value)) throw Error("Введите цвет профиля в формате #RRGGBB.");
  return value.toUpperCase();
}
export function safeProfileColor(value: unknown, fallback: string): string {
  try { return normalizeProfileColor(value, fallback); } catch { return fallback; }
}
/** Presentation deliberately ignores legacy theme, cardStyle and layout. */
export function profileAppearance(settings: {profileTopColor?: unknown; profileBottomColor?: unknown; accentColor: string}) {
  return {
    "--profile-top-color": safeProfileColor(settings.profileTopColor, DEFAULT_PROFILE_TOP),
    "--profile-bottom-color": safeProfileColor(settings.profileBottomColor, DEFAULT_PROFILE_BOTTOM),
    "--profile-accent": resolveAccent("DEFAULT", settings.accentColor),
  };
}
