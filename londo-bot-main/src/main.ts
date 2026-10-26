/** Single production entrypoint for the bot process. */
import { config } from "dotenv";

config({ path: process.env.LONDO_ENV_FILE ?? ".testingenv" });
await import("./index.js");
