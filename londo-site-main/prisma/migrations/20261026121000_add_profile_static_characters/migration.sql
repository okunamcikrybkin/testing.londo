ALTER TABLE "profile_customizations"
  ADD COLUMN IF NOT EXISTS "customStaticId" TEXT,
  ADD COLUMN IF NOT EXISTS "characters" JSONB NOT NULL DEFAULT '[]';
