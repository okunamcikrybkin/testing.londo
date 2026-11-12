# LONDO Bot

Discord bot for LONDO server automation, including roster discovery and temporary voice rooms.

## Local setup

1. Copy `.env.example` to `.env`.
2. Set the Discord bot token, target guild ID, and the three role IDs.
3. Enable **Server Members Intent** for this bot in the Discord Developer Portal.
4. Install dependencies with `npm install`.
5. Run `npm run dev` or `npm start`.

## Read-only roster rule

- MEMPHIS: member has both `FAM_ROLE_ID` and `MEMPHIS_ROLE_ID`.
- PHOENIX: member has both `FAM_ROLE_ID` and `PHOENIX_ROLE_ID`.
- A member with both family roles is treated as unclassified and is excluded from both rosters until corrected.

## Temporary voice rooms

The bot automatically maintains the settings panel in text channel `1545123267113918573`. Joining voice channel `1545123267113918574` creates or reopens the member's room in category `1545123267113918572`. Empty rooms are deleted after one minute.

No additional environment variables are required. The bot needs **Manage Channels**, **Move Members**, and **Create Instant Invite** on the server, plus permission to view, connect to, create invites, manage channels, and move members in the temporary-room category. In the trigger channel, it needs **Move Members**. In the panel channel, it needs **View Channel**, **Send Messages**, **Embed Links**, and **Read Message History**.

The panel provides controls for room name, participant limit, visibility, entry lock, voice chat, access, kicking, invites, region, waiting mode, ownership transfer, and deletion. Room owners and server administrators can use it.
