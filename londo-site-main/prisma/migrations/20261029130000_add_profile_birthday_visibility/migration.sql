ALTER TABLE "profile_customizations"
ADD COLUMN IF NOT EXISTS "showBirthday" BOOLEAN NOT NULL DEFAULT true;
