import type { RosterEntry } from "./data";
import { FAMILY_RANKS } from "../rank-appearance/catalog";

export const ROSTER_COLUMNS = [
  { key: "name", label: "Имя" }, { key: "birthday", label: "День рождения" }, { key: "static", label: "Статик" },
  { key: "discord", label: "Discord ID" }, { key: "rank", label: "Ранг" },
  { key: "voice", label: "Время в войсе" }, { key: "coins", label: "Монеты" },
] as const;
export type SortKey = typeof ROSTER_COLUMNS[number]["key"];
export type RosterSort = { key: SortKey; direction: "asc" | "desc" };
export const DEFAULT_SORT: RosterSort = { key: "rank", direction: "desc" };
export function nextRosterSort(current: RosterSort, key: SortKey): RosterSort {
  return { key, direction: current.key === key ? (current.direction === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc" };
}
const names = new Intl.Collator("ru", { sensitivity: "base", numeric: true });
const rankPriority = new Map(FAMILY_RANKS.map(rank => [rank.roleId, rank.priority]));
const name = (row: RosterEntry) => row.gameNickname ?? row.discordDisplayName;
const compareInteger = (a: string, b: string) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0;

/** Compare decimal strings exactly, without rounding balances through Number. */
export function compareDecimal(a: string, b: string): number {
  const parts = (value: string) => {
    const [mantissa, exponent = "0"] = value.toLowerCase().split("e");
    const [whole, fraction = ""] = mantissa.replace(/^[+-]/, "").split(".");
    return { coefficient: BigInt((mantissa.startsWith("-") ? "-" : "") + whole + fraction), scale: fraction.length - Number(exponent) };
  };
  const left = parts(a), right = parts(b), scale = Math.max(left.scale, right.scale);
  const x = left.coefficient * BigInt(10) ** BigInt(scale - left.scale);
  const y = right.coefficient * BigInt(10) ** BigInt(scale - right.scale);
  return x < y ? -1 : x > y ? 1 : 0;
}

export function selectRoster(rows: readonly RosterEntry[], query: string, sort: RosterSort = DEFAULT_SORT): RosterEntry[] {
  const search = query.trim().toLocaleLowerCase("ru");
  return rows.filter(row => [row.gameNickname, row.discordDisplayName, row.username, row.staticId, row.birthday, row.discordUserId, row.rankDisplayName ?? "Без ранга"]
    .some(value => value?.toLocaleLowerCase("ru").includes(search))).sort((a, b) => {
    let result = 0;
    const direction = sort.direction === "asc" ? 1 : -1;
    if (sort.key === "static") {
      const emptyA = !a.staticId?.trim(), emptyB = !b.staticId?.trim();
      if (emptyA !== emptyB) return emptyA ? 1 : -1;
      if (!emptyA && !emptyB) result = compareInteger(a.staticId!, b.staticId!);
    } else if (sort.key === "birthday") {
      const birthdayA = a.birthday?.split(".").reverse().join("") ?? "";
      const birthdayB = b.birthday?.split(".").reverse().join("") ?? "";
      if ((!birthdayA) !== (!birthdayB)) return birthdayA ? -1 : 1;
      if (birthdayA && birthdayB) result = compareInteger(birthdayA, birthdayB);
    } else if (sort.key === "rank") {
      const x = rankPriority.get(a.rankRoleId ?? "") ?? 0, y = rankPriority.get(b.rankRoleId ?? "") ?? 0;
      if ((x === 0) !== (y === 0)) return x === 0 ? 1 : -1;
      result = x - y;
    } else if (sort.key === "name") result = names.compare(name(a), name(b));
    else if (sort.key === "discord") result = compareInteger(a.discordUserId, b.discordUserId);
    else if (sort.key === "voice") result = a.totalVoiceSeconds < b.totalVoiceSeconds ? -1 : a.totalVoiceSeconds > b.totalVoiceSeconds ? 1 : 0;
    else result = compareDecimal(a.balance, b.balance);
    return result * direction || names.compare(name(a), name(b)) || compareInteger(a.discordUserId, b.discordUserId);
  });
}
