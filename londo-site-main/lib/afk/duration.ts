export const VACATION_TIME_ZONE = "Europe/Moscow";
const MINUTE = 60000;
const DAY = 24 * 60 * MINUTE;
export const VACATION_MAX_DURATION = Math.max(MINUTE, Number(process.env.VACATION_MAX_HOURS || 168) * 60 * MINUTE);
const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: VACATION_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
type WallTime = { year: number; month: number; day: number; hour: number; minute: number };
function parts(date: Date): WallTime & { second: number } {
  const values = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second) };
}
function validCalendar(wall: WallTime): boolean {
  const date = new Date(Date.UTC(wall.year, wall.month - 1, wall.day));
  return wall.year >= 1000 && wall.year <= 9999 && date.getUTCFullYear() === wall.year && date.getUTCMonth() + 1 === wall.month && date.getUTCDate() === wall.day && wall.hour >= 0 && wall.hour <= 23 && wall.minute >= 0 && wall.minute <= 59;
}
// Match actual instants to wall-clock fields; reject DST gaps and consider both repeated-hour offsets.
function instants(wall: WallTime): number[] {
  if (!validCalendar(wall)) return [];
  const utc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const offsets = new Set<number>();
  for (const delta of [-DAY, 0, DAY]) {
    const probe = utc + delta, local = parts(new Date(probe));
    offsets.add(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second) - probe);
  }
  return [...offsets].map(offset => utc - offset).filter(instant => {
    const local = parts(new Date(instant));
    return (Object.keys(wall) as (keyof WallTime)[]).every(key => wall[key] === local[key]);
  }).sort((a, b) => a - b);
}
export function parseVacationEnd(value: unknown, now = new Date(), maxDuration = VACATION_MAX_DURATION): Date {
  if (typeof value !== "string" || !Number.isFinite(+now)) throw Error("INVALID_DURATION");
  const text = value.trim();
  let timestamp: number;
  const relative = /^(\d+)([mhd])?$/i.exec(text);
  const local = /^(\d{2}):(\d{2})(?:\s+(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?)?$/.exec(text);
  if (relative) {
    const unit = (relative[2] || "m").toLowerCase(); // Old minute-only modal submissions remain valid.
    timestamp = +now + Number(relative[1]) * (unit === "d" ? DAY : unit === "h" ? 60 * MINUTE : MINUTE);
  } else if (local) {
    const today = parts(now), hour = Number(local[1]), minute = Number(local[2]);
    const dates: WallTime[] = [];
    if (local[3]) {
      const year = local[5] ? Number(local[5]) : today.year;
      dates.push({ year, month: Number(local[4]), day: Number(local[3]), hour, minute });
      if (!local[5]) dates.push({ ...dates[0], year: year + 1 });
    } else {
      dates.push({ year: today.year, month: today.month, day: today.day, hour, minute });
      const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
      dates.push({ year: tomorrow.getUTCFullYear(), month: tomorrow.getUTCMonth() + 1, day: tomorrow.getUTCDate(), hour, minute });
    }
    timestamp = dates.flatMap(instants).find(instant => instant > +now) ?? NaN;
  } else if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(text)) {
    // Preserve the protected API's existing explicit-offset ISO format.
    const [year, month, day] = text.slice(0, 10).split("-").map(Number);
    timestamp = validCalendar({year, month, day, hour: 0, minute: 0}) ? +new Date(text) : NaN;
  } else throw Error("INVALID_DURATION");
  const duration = timestamp - +now;
  if (!Number.isFinite(duration) || duration < MINUTE || duration > maxDuration) throw Error("INVALID_DURATION");
  return new Date(timestamp);
}
