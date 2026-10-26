# Manual coins administration

`/economy` and GET `/api/economy/users?q=`, GET `/api/economy/history`, POST
`/api/economy/grant`, POST `/api/economy/debit` require an active authenticated
session with `effectiveAccess === "FULL_ACCESS"`. Every endpoint uses the existing
session resolver backed by `FULL_ACCESS_DISCORD_IDS`. Other users, including OWNER,
receive HTTP 403. The page redirects to the dashboard; its entry is in the profile
menu under `Панель администратора` and appears only for users with an available
administrative settings section.

Search combines User, DiscordIdentity, FamilyMembership and VoiceProfile data:
Discord ID, username, display name, game nickname, static ID, active families,
current coins and read-only XP. A target must already exist as User or DiscordIdentity.

Amounts use the existing Decimal(20,4) balance: positive, at most 1,000,000 per
operation, up to four decimal places. Reason is required, trimmed, max 500 characters.
The server inserts a missing profile safely, locks the profile row FOR UPDATE,
conditionally changes the balance, inserts EconomyTransaction and AuditLog in one
transaction. Debits cannot exceed balance; credits guard the Decimal storage limit.

Ledger type remains CREDIT / DEBIT; reasons are ADMIN_GRANT / ADMIN_DEBIT, source ADMIN.
Audit actions: ECONOMY_ADMIN_GRANT / ECONOMY_ADMIN_DEBIT. Metadata includes target,
amount, reason, actor Discord ID, names and transaction ID, without secrets.
The existing unique ledger sourceId implements actor-scoped request idempotency.
A reused key with different operation, target, amount or reason is rejected.
The client retains uncertain requests for safe retry and disables repeat submissions.

History includes only manual operations, with target/type/UTC date filters and
50 entries per page. Automatic voice, roulette, shop and giveaway flows are unchanged.
Migration `20260907170000_add_manual_economy` adds only three enum values; no new tables
or currencies. Apply with Prisma migrate deploy, regenerate Prisma Client, restart site.
No bot code or configuration changes are needed.

Verification: npm run lint; npx tsc --noEmit; npm test; npm run build.
After building, `npx tsx scripts/economy-integration.ts` runs real HTTP and PostgreSQL
concurrency tests using an isolated temporary schema and synthetic sessions. The
schema is removed afterward and real balances are never modified.
