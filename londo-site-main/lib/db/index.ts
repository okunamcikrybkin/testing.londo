/**
 * Contract for the persistence layer that will be backed by PostgreSQL in
 * Phase 2. Keeping this boundary dependency-free lets the UI and auth layers
 * compile before Prisma is introduced.
 */
export { prisma } from "@/lib/db/prisma";

export type PersistenceLayer = {
  kind: "postgresql";
};

export const persistenceLayer: PersistenceLayer = {
  kind: "postgresql",
};
