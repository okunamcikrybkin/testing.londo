-- Preserve existing profiles; legacy color mapping happens when settings are read.
ALTER TABLE "profile_customizations" ADD COLUMN "avatarFrameColor" TEXT;
