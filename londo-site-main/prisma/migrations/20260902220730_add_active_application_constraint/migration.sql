-- Prevent duplicate active applications for the same Discord user and family.
CREATE UNIQUE INDEX IF NOT EXISTS "family_applications_active_family_discord_user_key"
ON "family_applications"("family", "discord_user_id")
WHERE "status" IN ('NEW', 'CALL');
