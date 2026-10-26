export const REJECTION_REASON_MAX_LENGTH = 1_000;

export function normalizeRejectionReason(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  return normalized && normalized.length <= REJECTION_REASON_MAX_LENGTH
    ? normalized
    : null;
}
