-- Preserve existing staff access while moving to the new role hierarchy.
ALTER TYPE "UserRole" RENAME VALUE 'MODERATOR' TO 'RECRUIT';
ALTER TYPE "UserRole" RENAME VALUE 'ADMIN' TO 'HIGH_STAFF';

CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "staff_access_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "requested_role" "UserRole" NOT NULL,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staff_access_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_access_requests_requested_role_check" CHECK ("requested_role" IN ('RECRUIT', 'HIGH_STAFF'))
);

CREATE INDEX "staff_access_requests_user_id_status_idx" ON "staff_access_requests"("user_id", "status");
CREATE INDEX "staff_access_requests_requested_role_status_created_at_idx" ON "staff_access_requests"("requested_role", "status", "created_at");
CREATE UNIQUE INDEX "staff_access_requests_one_pending_per_user" ON "staff_access_requests"("user_id") WHERE "status" = 'PENDING';

ALTER TABLE "staff_access_requests" ADD CONSTRAINT "staff_access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_access_requests" ADD CONSTRAINT "staff_access_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
