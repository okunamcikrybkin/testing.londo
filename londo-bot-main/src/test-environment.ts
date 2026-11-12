const snowflake = (index: number) => `${"1".repeat(17)}${String(index).padStart(3, "0")}`;
const variables = [
  "DISCORD_GUILD_ID",
  "FAM_ROLE_ID",
  "MEMPHIS_ROLE_ID",
  "OWNER_ROLE_ID",
  "MEMPHIS_DEP_OWNER_ROLE_ID",
  "MEMPHIS_HIGH_STAFF_ROLE_ID",
  "MEMPHIS_CUR_RECRUIT_ROLE_ID",
  "MEMPHIS_RECRUIT_ROLE_ID",
  "MAIN_ROLE_ID",
  "LONDEST_LONDO_ROLE_ID",
  "LONDO_ROLE_ID",
  "YOUNG_LONDO_ROLE_ID",
  "BABY_LONDO_ROLE_ID",
  "NEWBIE_ROLE_ID",
  "BIRTHDAY_ROLE_ID",
  "BIRTHDAY_CHANNEL_ID",
  "TEMPORARY_VOICE_PANEL_CHANNEL_ID",
  "TEMPORARY_VOICE_TRIGGER_CHANNEL_ID",
  "TEMPORARY_VOICE_CATEGORY_ID",
];

variables.forEach((name, index) => { process.env[name] = snowflake(index + 1); });
process.env.DISCORD_RECRUIT_ROLE_IDS = snowflake(30);
process.env.DISCORD_HIGH_STAFF_ROLE_IDS = snowflake(31);
process.env.NICKNAME_GUARD_EXEMPT_ROLE_IDS = [process.env.OWNER_ROLE_ID, process.env.MEMPHIS_HIGH_STAFF_ROLE_ID].join(",");
