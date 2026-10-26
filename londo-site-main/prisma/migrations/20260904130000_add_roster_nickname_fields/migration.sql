-- The initial roster migration was already applied before nickname parsing was added.
-- Add only the two nullable identity fields required by the current roster snapshot.
ALTER TABLE "discord_identities"
  ADD COLUMN IF NOT EXISTS "game_nickname" TEXT,
  ADD COLUMN IF NOT EXISTS "static_id" TEXT;
