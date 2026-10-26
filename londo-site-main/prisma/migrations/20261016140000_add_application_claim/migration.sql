ALTER TABLE "family_applications"
ADD COLUMN "claimed_by_user_id" TEXT,
ADD COLUMN "claimed_at" TIMESTAMP(3);

CREATE INDEX "family_applications_claimed_by_user_id_status_idx"
ON "family_applications"("claimed_by_user_id", "status");

ALTER TABLE "family_applications"
ADD CONSTRAINT "family_applications_claimed_by_user_id_fkey"
FOREIGN KEY ("claimed_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "promotion_applications"
ADD COLUMN "claimedByDiscordId" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3);

ALTER TABLE "afk_applications"
ADD COLUMN "claimed_by_discord_id" TEXT,
ADD COLUMN "claimed_at" TIMESTAMP(3);
