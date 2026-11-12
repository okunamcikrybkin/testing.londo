const MOSCOW_TIME_ZONE = "Europe/Moscow";

export function formatApplicationDate(
  value: Date | string | null,
  includeTime = true,
): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);
  const options: Intl.DateTimeFormatOptions = includeTime
    ? { dateStyle: "medium", timeStyle: "short", timeZone: MOSCOW_TIME_ZONE }
    : { day: "numeric", month: "long", year: "numeric", timeZone: MOSCOW_TIME_ZONE };

  return `${new Intl.DateTimeFormat("ru-RU", options).format(date)} (МСК)`;
}
