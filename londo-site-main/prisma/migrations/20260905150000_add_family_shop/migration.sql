-- Additive family shop schema. Existing economy and application data is not changed or removed.
ALTER TYPE "EconomyTransactionType" ADD VALUE IF NOT EXISTS 'DEBIT';
ALTER TYPE "EconomyTransactionReason" ADD VALUE IF NOT EXISTS 'SHOP_PURCHASE';
ALTER TYPE "EconomyTransactionReason" ADD VALUE IF NOT EXISTS 'SHOP_REFUND';
ALTER TYPE "EconomyTransactionSource" ADD VALUE IF NOT EXISTS 'SHOP';
CREATE TYPE "ShopStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "ShopItemType" AS ENUM ('MANUAL', 'DISCORD_ROLE');
CREATE TYPE "ShopPurchaseStatus" AS ENUM ('PENDING_FULFILLMENT', 'COMPLETED', 'REFUNDED');
CREATE TABLE "family_shop_settings" (
  "id" TEXT NOT NULL, "family" "Family" NOT NULL, "title" TEXT NOT NULL DEFAULT '🛒 Магазин семьи',
  "description" TEXT NOT NULL DEFAULT 'Магазин открыт. Покупай товары через кнопки справа.', "closed_text" TEXT,
  "status" "ShopStatus" NOT NULL DEFAULT 'OPEN', "discord_channel_id" TEXT, "discord_message_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "family_shop_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "family_shop_settings_family_key" ON "family_shop_settings"("family");
CREATE TABLE "shop_items" (
  "id" TEXT NOT NULL, "family" "Family" NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "price" DECIMAL(20,4) NOT NULL, "type" "ShopItemType" NOT NULL, "discord_role_id" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0, "is_active" BOOLEAN NOT NULL DEFAULT true, "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "shop_items_family_is_active_sort_order_idx" ON "shop_items"("family", "is_active", "sort_order");
CREATE TABLE "shop_purchases" (
  "id" TEXT NOT NULL, "item_id" TEXT NOT NULL, "family" "Family" NOT NULL, "discord_user_id" TEXT NOT NULL,
  "price" DECIMAL(20,4) NOT NULL, "type" "ShopItemType" NOT NULL, "status" "ShopPurchaseStatus" NOT NULL DEFAULT 'PENDING_FULFILLMENT',
  "completed_at" TIMESTAMP(3), "refunded_at" TIMESTAMP(3), "fulfilled_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shop_purchases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "shop_purchases_family_status_created_at_idx" ON "shop_purchases"("family", "status", "created_at");
CREATE INDEX "shop_purchases_discord_user_id_created_at_idx" ON "shop_purchases"("discord_user_id", "created_at");
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_family_fkey" FOREIGN KEY ("family") REFERENCES "family_shop_settings"("family") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "shop_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_discord_user_id_fkey" FOREIGN KEY ("discord_user_id") REFERENCES "voice_profiles"("discord_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_fulfilled_by_id_fkey" FOREIGN KEY ("fulfilled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "economy_transactions" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
