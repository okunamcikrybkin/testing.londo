import type { WheelPrize } from "./wheel";
export type Prize = WheelPrize & { description: string | null; weight: number; coinAmount: string | null; discordRoleId: string | null; manualText: string | null; isActive: boolean; sortOrder: number };
export type Settings = { isEnabled: boolean; paidSpinPrice: string; freeSpinCooldownHours: number };
export type Spin = { id: string; userId: string; discordUserId: string; prizeId: string; prizeName: string; prizeType: string; spinType: string; pricePaid: string; coinAmount: string | null; manualText: string | null; status: string; deliveryNote: string | null; createdAt: string };
export type State = { settings: Settings; prizes: WheelPrize[]; balance: string; history: Spin[]; nextFreeAt: string | null; serverNow: string };
export const statusLabel: Record<string,string> = { COMPLETED: "Выдано", PENDING_DELIVERY: "Ожидает выдачи роли", PENDING_FULFILLMENT: "Ожидает выдачи", FAILED: "Требуется проверка" };
export function coins(value: string | number) { return Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 4 }); }
