# Atemii Architecture

## Current Phase

Phase 4 adds the staff-only MEMPHIS/PHOENIX application system. PostgreSQL now
stores family applications separately, while Discord operations stay in a
server-only integration layer.

## Route Boundaries

- `app/(marketing)` contains public pages such as the landing page.
- `app/(dashboard)` is reserved for authenticated user routes.
- `app/(admin)` is reserved for role-protected administration routes.
- `app/api/auth` contains authentication route handlers.
- `app/applications` contains protected application overview, family lists, and details.
- `app/api/applications` is the server-to-server intake endpoint used by the Discord bot.

Route groups do not affect URLs. They make it possible to add separate layouts
for public, dashboard, and admin experiences without changing route paths.

## Server Boundaries

- `lib/auth` owns session lookup, login, logout, and OAuth callbacks.
- `lib/db` owns the reusable Prisma Client and future repositories.
- `lib/discord` owns Discord identity mapping and avatar helpers.
- `lib/discord/client.ts` and `lib/discord/applications.ts` own bot REST calls,
  channel creation, role assignment, and channel cleanup.
- `lib/discord/application-form.ts` owns signed Discord Interactions, the
  family-selection flow, modal data mapping, and entry-message publishing.
- `lib/applications` owns family parsing, intake validation, staff authorization,
  queries, and server actions.
- `lib/permissions` owns RBAC roles and permission checks.

## Prisma Data Model

- `User` stores Discord identity fields, optional email/avatar, role, status,
  timestamps, and last login time.
- `Session` stores a hashed session token, expiry, and its owning user.
- `AuditLog` records privileged activity, optional targets, and JSON metadata.
- `UserRole` supports `USER`, `MODERATOR`, `ADMIN`, and `OWNER`.
- `UserStatus` supports `ACTIVE`, `SUSPENDED`, and `BANNED`.
- `FamilyApplication` records the Discord profile snapshot, JSON answers,
  reviewer, Discord channels, timestamps, and final decision.
- `Family` supports `MEMPHIS` and `PHOENIX`; every query includes a family filter.
- `ApplicationStatus` supports `NEW`, `CALL`, `ACCEPTED`, and `REJECTED`.
- A partial unique index prevents more than one active application for the same
  Discord user in the same family.

## Authentication Flow

1. The login route generates a cryptographically random OAuth `state` and sets a short-lived httpOnly cookie.
2. The callback validates `state`, exchanges the authorization code on the server, and requests only Discord's `identify` scope.
3. Discord identity data upserts a `User` by `discordId`; existing roles are never changed by login.
4. Atemii creates a random opaque session token, stores only its SHA-256 hash in PostgreSQL, and returns the raw token only in an httpOnly cookie.
5. `getCurrentUser` validates the cookie hash, expiry, and `ACTIVE` user status on the server.
6. Sign-out deletes the persisted session and expires the cookie.

## Application Flow

1. A trusted Discord backend posts a validated application to `/api/applications`.
2. Intake creates an application in `NEW` and writes `APPLICATION_CREATED`.
3. Staff starts a call only after Discord confirms creation of the text and voice channels; then the record moves to `CALL` and logs `APPLICATION_CALL_STARTED`.
4. Staff accepts only after Discord confirms role assignment; then the record moves to `ACCEPTED` and logs `APPLICATION_ACCEPTED`.
5. Rejection requires a reason, moves the record to `REJECTED`, logs `APPLICATION_REJECTED`, and attempts channel cleanup when channels exist.
6. Short-lived operation locks and conditional updates protect against two staff users completing the same action concurrently.

## Required Discord Configuration

The application intentionally has no IDs or tokens in source control. Configure
`DISCORD_BOT_TOKEN`, `DISCORD_BOT_API_SECRET`, `DISCORD_GUILD_ID`, both family
category IDs, staff role ID lists, and accepted-member role ID lists in the
deployment environment. A missing setting returns a controlled configuration
error and does not change the application status.

## Discord Application Intake

Discord delivers signed component and modal interactions to
`POST /api/discord/interactions`. The route verifies Ed25519 signatures using
`DISCORD_APPLICATION_PUBLIC_KEY` before it accepts the interaction. The bot can
publish the entry message through the server-only form module; no browser code
receives a bot token.

The flow uses a fixed custom-ID namespace: the entry button presents the two
allowed families, a family button opens the modal, and the modal ID supplies the
family server-side. Form answers are stored only with stable keys:
`gameNicknameStatic`, `oocAge`, `joinReason`, `discoverySource`, and
`charactersScreenshotUrl`. The Discord user identity is read from the signed
interaction payload.

## Next Phase

The future admin panel must keep server-side permission checks. Header menu
visibility is not an authorization boundary.
