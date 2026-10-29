ALTER TABLE "profile_customizations"
  ALTER COLUMN "showStaticId" SET DEFAULT true;

UPDATE "profile_customizations"
SET "showStaticId" = true
WHERE "showStaticId" = false;
