-- CreateTable
CREATE TABLE "faction_role_panel_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "channelId" TEXT,
    "messageId" TEXT,
    "publishedChannelId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Выдача ролей фракции',
    "description" TEXT NOT NULL DEFAULT 'Нажми на кнопку с названием фракции, чтобы получить или снять роль.',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faction_role_panel_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_role_buttons" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "discordRoleId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faction_role_buttons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faction_role_operations" (
    "id" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "buttonId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faction_role_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faction_role_buttons_panelId_sortOrder_idx" ON "faction_role_buttons"("panelId", "sortOrder");

-- CreateIndex
CREATE INDEX "faction_role_operations_discordUserId_buttonId_createdAt_idx" ON "faction_role_operations"("discordUserId", "buttonId", "createdAt");

-- AddForeignKey
ALTER TABLE "faction_role_buttons" ADD CONSTRAINT "faction_role_buttons_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "faction_role_panel_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

