-- Additive only; existing profiles use application defaults for NULL colors.
ALTER TABLE "profile_customizations"
ADD COLUMN "profileTopColor" TEXT,
ADD COLUMN "profileBottomColor" TEXT;
