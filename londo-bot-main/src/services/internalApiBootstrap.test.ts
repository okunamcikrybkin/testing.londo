import assert from "node:assert/strict";
import test from "node:test";
import type { Server } from "node:http";
import type { Guild } from "discord.js";
import { bootstrapInternalApi } from "./internalApiBootstrap.js";
import type { ApplicationConfig, FamilyRoleIds } from "../types/family.js";

const config: ApplicationConfig = { applicationChannelId: "channel", callCategoryId: "category", port: 3101, staffRoleIds: { MEMPHIS: [], PHOENIX: [] }, acceptRoleIds: { MEMPHIS: [], PHOENIX: [] } };
const roles: FamilyRoleIds = { fam: "fam", memphis: "memphis", phoenix: "phoenix" };

test("bootstrap starts the internal API with the configured local port and shared secret", () => {
  let received: { guild: Guild; config: ApplicationConfig; roles: FamilyRoleIds; secret: string } | null = null;
  const server = {} as Server;
  const guild = {} as Guild;
  const result = bootstrapInternalApi(guild, config, roles, "test-secret", (event) => event, (receivedGuild, receivedConfig, receivedRoles, receivedSecret) => {
    received = { guild: receivedGuild, config: receivedConfig, roles: receivedRoles, secret: receivedSecret };
    return server;
  });
  assert.equal(result, server);
  assert.deepEqual(received, { guild, config, roles, secret: "test-secret" });
});
