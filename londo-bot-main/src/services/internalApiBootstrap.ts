import type { Server } from "node:http";
import type { Guild } from "discord.js";
import { startApplicationServer, type ApplicationServerEvent } from "./applicationServer.js";
import type { ApplicationConfig, FamilyRoleIds } from "../types/family.js";
import type { GiveawayManager } from "./giveaways.js";

type ApplicationServerStarter = (
  guild: Guild,
  config: ApplicationConfig,
  roles: FamilyRoleIds,
  secret: string,
  onEvent?: (event: ApplicationServerEvent) => void,
  giveawayManager?: GiveawayManager | null,
) => Server;

/** Starts the local API independently from optional site log delivery. */
export function bootstrapInternalApi(
  guild: Guild,
  config: ApplicationConfig,
  roles: FamilyRoleIds,
  secret: string,
  onEvent?: (event: ApplicationServerEvent) => void,
  startServer: ApplicationServerStarter = startApplicationServer,
  giveawayManager?: GiveawayManager | null,
): Server {
  return startServer(guild, config, roles, secret, onEvent, giveawayManager);
}
