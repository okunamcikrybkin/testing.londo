export type WheelPrize = { id: string; name: string; type: string };
// Sector zero starts at twelve o'clock; pointer is fixed at zero degrees.
export function winningRotation(prizes: WheelPrize[], id: string, current: number) {
  const index = prizes.findIndex(p => p.id === id);
  if (index < 0 || !prizes.length) throw Error("WINNER_NOT_ON_WHEEL");
  const target = (360 - (index + 0.5) * 360 / prizes.length) % 360;
  return current + 360 * 6 + ((target - current % 360 + 360) % 360);
}
export function pointerIndex(rotation: number, count: number) { return Math.floor(((360 - rotation % 360) % 360) / (360 / count)); }
