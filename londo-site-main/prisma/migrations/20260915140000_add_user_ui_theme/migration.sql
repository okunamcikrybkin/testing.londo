-- Presentation preference only. Existing users retain the original interface.
ALTER TABLE "users" ADD COLUMN "ui_theme" TEXT NOT NULL DEFAULT 'ORIGINAL';
ALTER TABLE "users" ADD CONSTRAINT "users_ui_theme_check" CHECK ("ui_theme" IN ('ORIGINAL','DARKPAN','NOIR','TERMINAL','GLASS'));
