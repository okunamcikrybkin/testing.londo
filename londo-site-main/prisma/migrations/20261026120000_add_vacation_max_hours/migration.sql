ALTER TABLE "family_notification_settings"
  ADD COLUMN IF NOT EXISTS "vacationMaxHours" INTEGER NOT NULL DEFAULT 168;
