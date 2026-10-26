# LONDO Roulette

The player interface is entirely on `/roulette`. Discord has no roulette commands,
buttons or draw logic. `OWNER` and `FULL_ACCESS` manage the catalog at
`/roulette/admin`, prizes at `/roulette/admin/prizes/new` and
`/roulette/admin/prizes/[id]`, and fulfillment at `/roulette/admin/history`.

## Database and economy

Migration: `20260907090000_add_site_roulette` (additive, Prisma migrate deploy).
Models: `RouletteSettings`, `RoulettePrize`, `RouletteSpin`.
The existing `VoiceProfile.balance` and `EconomyTransaction` ledger remain the
only currency. The migration extends the ledger reason/source enums.
Default settings: enabled, paid price 25, free cooldown 24 hours. No prizes seeded.

Spin requests contain only `spinType` and `requestId`. The authenticated identity
comes from the existing session. `(userId, requestId)` is unique. First profile
creation uses INSERT ON CONFLICT; the profile row is then locked FOR UPDATE.
Cooldown history is checked under that lock, including parallel requests from
other tabs. Paid debit is conditional on sufficient balance. Coin credit, ledger
entries and the spin record commit in the same PostgreSQL transaction.

Settings/catalog edits lock the singleton settings row exclusively. Draws lock it
FOR SHARE, then read active prizes. Weights are positive integers up to 1,000,000;
at most 24 prizes can be active. `crypto.randomInt(totalWeight)` chooses the winner.
The ledger stores `rouletteSpinId`, `roulettePrizeId`, `spinType` in metadata.
Each spin also preserves prize fulfillment fields and its wheel catalog snapshot,
so edits, deactivation and soft deletion cannot change an existing entitlement.

## UI and delivery

React/SVG/CSS wheel makes six full rotations and eases to the center of the server
selected sector in 5 seconds (350ms with reduced motion). Sector sizes are equal;
configured weights determine probabilities, as explained in the admin UI.
The result dialog is keyboard accessible. Balance, cooldown and recent personal
history refresh after the animation; there is no network polling. The countdown
uses server time. A failed network request retains its idempotency key for retry.

- COINS: balance and credit ledger updated atomically; status COMPLETED.
- MANUAL: PENDING_FULFILLMENT until an owner presses `Выдано`; completion is audited.
- DISCORD_ROLE: PENDING_DELIVERY until the protected bot endpoint confirms the grant.
  A timeout never changes the winner or refunds/replaces the prize. Admin history
  offers an explicit `Повторить выдачу` action; there is no automatic delivery worker.
  An already-owned role is completed with a visible explanation, without compensation.
- NOTHING: completed without a reward.

Role options reuse `/api/shop/options`; no manual role ID entry is needed.
Bot verifies member, role, managed role restrictions, ManageRoles permission and
hierarchy. Role grants are idempotent. Site-to-bot requests use the existing
`LONDO_BOT_INTERNAL_URL` / `LONDO_BOT_API_SECRET` configuration.

## Endpoints

- GET `/api/roulette`: settings, balance, active display catalog and own history.
- POST `/api/roulette/spin`: draw and return the committed result and wheel snapshot.
- PATCH `/api/roulette/admin/settings`.
- POST `/api/roulette/admin/prizes`.
- PATCH / DELETE `/api/roulette/admin/prizes/[id]` (deletion archives the prize).
- POST `/api/roulette/admin/history/[id]`: `complete` / `retry`.
- Bot POST `/internal/discord/roulette/deliver`: shared-secret protected role delivery.

All site API mutations validate session access and same-origin requests. Admin
pages and endpoints enforce access separately. User history never accepts a
client-supplied user ID. Admin history supports user, prize, type and status filters
with 50 rows per page. Existing OAuth/RBAC behavior is reused without modification.

## Verification and launch

Run site lint, tsc, tests, build; run bot lint, tsc, tests.
`npx tsx scripts/roulette-integration.ts` requires a built site and the confirmed
development PostgreSQL connection. It creates an isolated `roulette_test_*` schema,
synthetic sessions and a mock bot, tests real HTTP/concurrent transactions, then
removes the schema. No actual Discord prize delivery occurs during these tests.

After updating Prisma Client and building, restart/redeploy the site. Restart the
bot to load its new delivery endpoint. Configure prizes, weights and assignable
roles in the admin UI before opening roulette to players. The bot role must be
above reward roles and have ManageRoles. No new environment variables are required.
