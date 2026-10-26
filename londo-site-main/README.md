# Atemii

Atemii is a Russian-language Next.js platform with a dark marketing experience,
a PostgreSQL persistence layer, Discord-based identity planned for Phase 3, and
a future dashboard and admin panel protected by role-based permissions.

## Current Status

Phases 1 through 4 prepare the application foundation. The landing page,
secure Discord OAuth, persisted httpOnly sessions, dashboard, profile page,
RBAC types, and the staff-only family application workspace are in place. The
full admin UI is intentionally reserved for a later phase.

## Stack

- Next.js 16 with the App Router
- React 19
- TypeScript with strict mode
- Tailwind CSS 4
- ESLint with Next.js rules
- Prisma 6 with PostgreSQL

## Local Development

Requirements: Node.js 20.9 or later and npm.

Install dependencies:

```bash
npm install
```

Create a local environment file from the template:

```powershell
Copy-Item .env.example .env.local
```

Set the required values in `.env.local` before running the application. Do not
add secrets to source files or commit `.env.local`.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Project Structure

```text
app/
  (marketing)/        Public landing page and its layout
  (dashboard)/        Reserved for authenticated user routes
  (admin)/            Reserved for role-protected administration routes
  api/auth/           Authentication route handlers
components/           Shared UI components
lib/
  auth/               Session and OAuth boundaries
  db/                 Prisma Client and persistence boundary
  discord/            Discord identity helpers
  permissions/        Roles and permission checks
docs/                 Architecture notes
prisma/
  schema.prisma        PostgreSQL data model
  migrations/          Versioned database migrations
```

Route groups such as `(marketing)` do not change public URLs. The marketing page
continues to use `/`.

## Environment Variables

`.env.example` documents the intended settings:

- `DATABASE_URL` for PostgreSQL and Prisma
- `AUTH_SECRET` reserved for future authentication extensions
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` for Discord OAuth
- `NEXT_PUBLIC_APP_URL` for the application origin
- `DISCORD_BOT_TOKEN` for server-only Discord bot API calls
- `DISCORD_BOT_API_SECRET` for server-to-server application intake
- `DISCORD_GUILD_ID` and family-specific category/role ID lists for the bot

Never commit `.env` or `.env.local`. The `.gitignore` preserves
`.env.example` as the safe template that can be committed.

## Discord OAuth Setup

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create or select an application.
2. Open **OAuth2** and add this Redirect URI for local development:
   `http://localhost:3000/api/auth/discord/callback`.
3. Copy the application's **Client ID** into `DISCORD_CLIENT_ID` in `.env.local`.
4. Open **OAuth2** or **General Information**, generate/copy the **Client Secret**, and put it only in `DISCORD_CLIENT_SECRET` in `.env.local`.
5. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`. Set a unique value for `AUTH_SECRET`; do not share any of these values or commit them.
6. Start the app with `npm run dev` and use **Войти через Discord**. Atemii requests only the `identify` scope.

The production Redirect URI must use the HTTPS origin configured by
`NEXT_PUBLIC_APP_URL`, followed by `/api/auth/discord/callback`.

## Family Applications

`/applications` is a staff workspace for the separate `MEMPHIS` and `PHOENIX`
application streams. Only `MODERATOR`, `ADMIN`, and `OWNER` roles can access
lists, details, and mutation actions; these checks run on the server.

Each application progresses through `NEW`, `CALL`, `ACCEPTED`, or `REJECTED`.
The same Discord user can have only one active (`NEW` or `CALL`) application in
each family. Completed applications remain in history.

The Discord bot creates applications through `POST /api/applications`. This is
a server-to-server endpoint and requires the internal secret in either the
`X-Internal-Secret` header or a `Bearer` authorization header. Do not call it
from browser code.

Example development payload shape:

```json
{
  "family": "MEMPHIS",
  "discordUserId": "discord-user-id",
  "discordUsername": "username",
  "discordDisplayName": "Display name",
  "discordAvatar": "https://cdn.discordapp.com/avatars/...",
  "answers": { "question": "answer" }
}
```

Before staff can start calls or accept applications, configure these values in
`.env.local`: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, the chosen family's
application category ID, staff role IDs, and accepted-member role IDs. The app
returns a safe configuration error instead of changing a status if they are
missing.

## Discord Application Form

Discord Interactions are handled by `POST /api/discord/interactions`. Discord
must be configured to send its Interactions Endpoint URL to this route. Atemii
verifies every request with `DISCORD_APPLICATION_PUBLIC_KEY` before it reads the
interaction payload.

The bot integration can publish the entry message with **📨 Подать заявку**.
The interaction flow is: entry button → family choice (`MEMPHIS` or `PHOENIX`)
→ Discord modal → trusted application intake. The selected family comes from a
verified interaction custom ID, not from user-provided form data.

The modal stores these stable JSON keys in `FamilyApplication.answers`:

- `gameNicknameStatic`
- `oocAge`
- `joinReason`
- `discoverySource`
- `charactersScreenshotUrl`

The form validates required text fields, an OOC age from 14 to 99, and an
`http` or `https` screenshot URL. A duplicate active application receives an
ephemeral Discord response and is not written to the database.

## Next Phase

Phase 4 can introduce the protected admin panel and manage RBAC permissions on
the server. See [docs/architecture.md](docs/architecture.md).
