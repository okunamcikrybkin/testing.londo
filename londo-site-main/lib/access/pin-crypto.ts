import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { validPin } from "./policy";
function secretPin(pin: string) {
  const dedicatedPepper = process.env.STAFF_PIN_PEPPER?.trim();
  const pepper = dedicatedPepper || process.env.AUTH_SECRET?.trim();
  if (!pepper || pepper.length < 32) throw new Error("PIN_SECURITY_NOT_CONFIGURED");
  return createHmac("sha256", pepper).update(dedicatedPepper ? pin : `LONDO_STAFF_PIN_V1:${pin}`).digest();
}
function derive(pin: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(secretPin(pin), salt, 32, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPin(pin: string): Promise<string> {
  if (!validPin(pin)) throw new Error("INVALID_PIN");
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(pin, salt)).toString("hex")}`;
}
export async function verifyPinHash(pin: string, encoded: string): Promise<boolean> {
  if (!validPin(pin)) return false;
  const parts = encoded.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt-v1" || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return false;
  return timingSafeEqual(await derive(pin, parts[1]), Buffer.from(parts[2], "hex"));
}
