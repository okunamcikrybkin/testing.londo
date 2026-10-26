import type { Family } from "@prisma/client";

export const FAMILY_SLUGS = ["memphis"] as const;

export type FamilySlug = (typeof FAMILY_SLUGS)[number];

export const FAMILY_COPY: Partial<Record<Family, { description: string; slug: FamilySlug }>> = {
  MEMPHIS: {
    description: "Заявки в семью MEMPHIS: новые обращения, обзвон и история решений.",
    slug: "memphis",
  },
};

export function familyFromSlug(value: string): Family | null {
  if (value === "memphis") {
    return "MEMPHIS";
  }

  return null;
}

export function familySlug(family: Family): FamilySlug {
  const copy = FAMILY_COPY[family];
  if (!copy) throw new Error("Семья больше недоступна.");
  return copy.slug;
}

export function familyLabel(family: Family): string {
  return family === "MEMPHIS" ? "MEMPHIS" : "Семья";
}
