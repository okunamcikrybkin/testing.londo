# LONDO Bot

Isolated Discord bot for read-only LONDO roster discovery. This project does not connect to the LONDO website or any database.

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

The bot only fetches guild, role, and member data. It does not modify Discord state.
