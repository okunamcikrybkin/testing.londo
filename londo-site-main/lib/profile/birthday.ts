export function safeBirthdayReturnPath(value: string | null | undefined): string {
  const path = value?.trim();
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\u0000-\u001f]/.test(path)) return "/";
  const pathname = path.split(/[?#]/, 1)[0];
  if (pathname === "/profile/birthday" || pathname.startsWith("/api/")) return "/";
  return path;
}

function birthdayTodayParts(now = new Date()) {
  const timeZone = process.env.BIRTHDAY_TIME_ZONE?.trim() || "Asia/Yekaterinburg";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, Number(part.value)])) as { year: number; month: number; day: number };
}

export function birthdayTodayIso(now = new Date()): string {
  const today = birthdayTodayParts(now);
  return `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
}

function ageWord(age: number): string {
  const lastTwo = age % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return "лет";
  const last = age % 10;
  return last === 1 ? "год" : last >= 2 && last <= 4 ? "года" : "лет";
}

export function formatBirthdayLabel(month: number | null | undefined, day: number | null | undefined, year: number | null | undefined, now = new Date()): string | null {
  if (!month || !day || !year) return null;
  const today = birthdayTodayParts(now);
  const age = today.year - year - (month > today.month || (month === today.month && day > today.day) ? 1 : 0);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year} (${age} ${ageWord(age)})`;
}

export function parseBirthdayDate(value: unknown, now = new Date()): { month: number; day: number; year: number } | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const russianDate = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(normalized);
  const browserDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!russianDate && !browserDate) return null;
  const day = Number(russianDate?.[1] ?? browserDate?.[3]);
  const month = Number(russianDate?.[2] ?? browserDate?.[2]);
  const year = Number(russianDate?.[3] ?? browserDate?.[1]);
  const isoDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (year < 1900 || isoDate > birthdayTodayIso(now)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return { month, day, year };
}
