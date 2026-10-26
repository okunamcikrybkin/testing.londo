# Family Shop

Management is available to existing OWNER/FULL_ACCESS users at /shop. MEMPHIS and PHOENIX have independent settings. Navigation already links to Shop. Create/edit uses /shop/items/new and /shop/items/[id]; ROLE maps to the existing DISCORD_ROLE enum. Existing item family is immutable to preserve purchase history.

Settings and role/channel options: /shop/settings. Select a permitted text channel for each family. Role choices exclude everyone, managed/integration/bot roles and roles at/above the bot. The bot requires Manage Roles and its highest role must be above goods it assigns. It requires View Channel, Send Messages and Read Message History in the selected text channel.

Site configuration reuses LONDO_BOT_INTERNAL_URL and LONDO_BOT_API_SECRET. Bot configuration reuses LONDO_SITE_URL and LONDO_BOT_API_SECRET. Never put these secrets into browser code. Restart both processes after installation.

## Migration gate

The user confirmed the current DATABASE_URL is the new atemii/LONDO Supabase dev database. On 2026-09-05, prisma migrate status reported only 20260905150000_add_family_shop pending; prisma migrate deploy applied it successfully. No production/Ravens database was accessed.

Only the existing migration 20260905150000_add_family_shop is used. It now includes the missing economy_transactions.metadata JSONB column, matching Prisma schema. Prisma Client has been generated.

The existing migration, including the metadata column, has now been applied. Do not edit it further or replay it. No new migration, reset, db push or data deletion was used.

## API

Staff: GET /api/shop; POST /api/shop/items; PATCH /api/shop/items/[id]; PATCH /api/shop/settings; GET /api/shop/options; POST /api/shop/refresh; POST /api/shop/purchases/[id]/complete and /refund. All repeat server-side manager authorization. No delete route is exposed.

Bot-to-site: GET/POST /api/internal/shop. Shared-secret protected, no-store responses; operations BUY, RESULT, SETTLE, PANEL. Site-to-bot: GET /internal/discord/shop/options; POST /internal/discord/shop/refresh and /role-check. Existing internal HTTP listener is reused.

## Correctness and recovery

Purchases lock the existing profile row, re-read and lock catalog/membership state, conditionally debit the existing coin balance, and create the purchase and ledger entry in one PostgreSQL transaction. Interaction ID is the unique ledger source, making delivery retries idempotent. The ledger metadata snapshots item ID, purchase ID, family, name and role ID. Price never comes from Discord.

Manual purchases remain PENDING_FULFILLMENT. Staff can complete or refund them in /shop/purchases. Refund claims the pending state and credits the balance and unique refund ledger entry in one transaction. Completed purchases cannot be refunded by these controls.

Roles are checked with Discord before debit. Already owned roles never charge. The bot grants roles and settles the purchase. Failed grants are rechecked against fresh Discord membership before refund. Ambiguous network failures remain pending and retry every 30 seconds and on startup. A successfully granted role whose settlement acknowledgement was lost is completed on retry. Run one active bot instance; the existing deployment uses a single Discord bot process.

Components V2 panel refresh edits the configured message. Missing messages are recreated. A per-family queue serializes refresh. A marker in recent messages helps recover lost create acknowledgements. Moving channels creates and persists the new panel first; old-message deletion is best effort. Catalogs use 8 items per page to stay within Discord component limits; additional pages are ephemeral. CLOSED disables buttons and is enforced again by the purchase transaction. Refresh errors are reported as warnings after database changes have been saved.

## Verification

Unit tests exercise purchase/settlement code with a serialized in-memory transaction adapter and Discord mocks. scripts/shop-db-check.ts also verified real PostgreSQL purchases, interaction retries, membership/closed/disabled rejection, metadata, manual completion and idempotent refunds inside one transaction which was rolled back; fixture absence was verified afterward. Independent multi-connection concurrency and real Discord interaction tests remain separate from these checks.

Run site lint, tsc --noEmit, npm test and npm run build; run bot lint, tsc --noEmit and npm test. scripts/shop-http-check.mjs checks 10 API denials and 5 page redirects against an isolated local site process. Do not use production credentials for test fixtures.
