ALTER TABLE "staff_access_requests"
ADD COLUMN "memphis_role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN "phoenix_role" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN "discord_role_ids" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "user_access_snapshots" ADD COLUMN "role_ids" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "sessions" ADD COLUMN "staff_pin_verified_at" TIMESTAMP(3), ADD COLUMN "staff_pin_credential_version" INTEGER;
CREATE TABLE "staff_access_grants" (
 "id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "role" "UserRole" NOT NULL, "memphis_role" "UserRole" NOT NULL DEFAULT 'USER', "phoenix_role" "UserRole" NOT NULL DEFAULT 'USER',
 "source_request_id" TEXT, "granted_by_user_id" TEXT, "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "revoked_at" TIMESTAMP(3), "revoked_by_user_id" TEXT, "revoke_reason" TEXT
);
CREATE INDEX "staff_access_grants_user_id_revoked_at_idx" ON "staff_access_grants"("user_id", "revoked_at");
CREATE UNIQUE INDEX "staff_access_grants_one_active_per_user" ON "staff_access_grants"("user_id") WHERE "revoked_at" IS NULL;
CREATE TABLE "staff_access_credentials" (
 "user_id" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "pin_hash" TEXT, "pin_set_at" TIMESTAMP(3), "failed_attempts" INTEGER NOT NULL DEFAULT 0,
 "locked_until" TIMESTAMP(3), "credential_version" INTEGER NOT NULL DEFAULT 1,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Preserve previously issued staff access; do not auto-approve pending requests.
INSERT INTO "staff_access_grants" ("id", "user_id", "role", "memphis_role", "phoenix_role", "source_request_id", "granted_by_user_id", "granted_at")
SELECT 'legacy_' || u."id", u."id", u."role",
 CASE WHEN u."role" = 'OWNER' THEN 'OWNER'::"UserRole" ELSE LEAST(u."role", COALESCE(s."memphis_role", 'USER'::"UserRole")) END,
 CASE WHEN u."role" = 'OWNER' THEN 'OWNER'::"UserRole" ELSE LEAST(u."role", COALESCE(s."phoenix_role", 'USER'::"UserRole")) END,
 r."id", r."reviewed_by_user_id", COALESCE(r."reviewed_at", u."updated_at")
FROM "users" u LEFT JOIN "user_access_snapshots" s ON s."user_id" = u."id"
LEFT JOIN LATERAL (SELECT * FROM "staff_access_requests" WHERE "user_id" = u."id" AND "status" = 'APPROVED' ORDER BY "reviewed_at" DESC LIMIT 1) r ON true
WHERE u."role" <> 'USER';
