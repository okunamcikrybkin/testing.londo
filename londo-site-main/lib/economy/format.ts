const decimalValue = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i;

export function formatCoins(value: string | number): string {
  const match = decimalValue.exec(String(value).trim());
  if (!match) throw new RangeError("Invalid coin amount.");

  const [, sign, whole, fraction = "", exponentText = "0"] = match;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) throw new RangeError("Coin amount is out of range.");

  const digits = whole + fraction;
  const integerLength = whole.length + exponent;
  const integer = integerLength <= 0
    ? "0"
    : integerLength >= digits.length
      ? digits.padEnd(integerLength, "0")
      : digits.slice(0, integerLength);
  const normalized = integer.replace(/^0+(?=\d)/, "");
  const signed = sign === "-" && normalized !== "0" ? `-${normalized}` : normalized;
  return signed;
}
