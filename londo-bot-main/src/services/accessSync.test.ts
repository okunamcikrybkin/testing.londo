import assert from "node:assert/strict";
import test from "node:test";
import type { Guild, GuildMember } from "discord.js";
import { FAMILY_RANKS } from "../config/familyRanks.js";
import { accessRolesChanged, observeAccess, readAccessMember, reconcileAccess, sendAccessObservations } from "./accessSync.js";
const recruit = FAMILY_RANKS.find(rank => rank.key === "MEMPHIS_RECRUIT")!.roleId;
const config = { siteUrl: "http://localhost:3000", apiSecret: "test-secret" };
const member = { discordId: "100000000000000001", roleIds: [recruit], observedAt: new Date().toISOString(), trigger: "ROLE_UPDATE" as const };
test("detect only access role grants/removals", () => {
  assert.equal(accessRolesChanged([], [recruit]), true); assert.equal(accessRolesChanged([recruit], []), true);
  assert.equal(accessRolesChanged([recruit, "other"], [recruit]), false);
});
test("unavailable site retries bounded and never throws", async () => {
  let attempts = 0;
  assert.equal(await sendAccessObservations(config, [member], { fetch: async () => { attempts++; throw Error("offline"); }, delay: async () => {} }), false);
  assert.equal(attempts, 3);
});
test("successful snapshot syncs only known users including verified departures", async () => {
  const posted: unknown[] = [];
  const ok = await reconcileAccess(config, [member], 1, new Date().toISOString(), "STARTUP_RECONCILIATION", { fetch: async (_url, options) => {
    assert.equal((options?.headers as Record<string, string>)["x-londo-bot-secret"], "test-secret");
    if (options?.method === "GET") return Response.json({ discordIds: [member.discordId, "100000000000000002"] });
    posted.push(JSON.parse(options!.body as string)); return Response.json({ results: [] });
  } });
  assert.equal(ok, true);
  assert.deepEqual((posted[0] as { roleIds: string[] }[]).map(m => m.roleIds), [[recruit], []]);
});
test("missing/incomplete/stale snapshots make no request and cannot revoke", async () => {
  let count = 0;
  const transport = { fetch: async () => { count++; return Response.json({}); } };
  for (const snapshot of [null, [], [member]]) assert.equal(await reconcileAccess(config, snapshot, 2, new Date().toISOString(), "PERIODIC_RECONCILIATION", transport), false);
  assert.equal(await reconcileAccess(config, [member], 1, new Date(Date.now() - 121_000).toISOString(), "PERIODIC_RECONCILIATION", transport), false);
  assert.equal(count, 0);
});
test("OAuth fresh member: API failure is not empty roles; unknown member is verified absent", async () => {
  const guild = (fetcher: () => Promise<unknown>) => ({ members: { fetch: fetcher } }) as unknown as Guild;
  await assert.rejects(readAccessMember(guild(async () => { throw { code: 50001 }; }), member.discordId));
  assert.deepEqual((await readAccessMember(guild(async () => { throw { code: 10007 }; }), member.discordId)).roleIds, []);
  assert.deepEqual((await readAccessMember(guild(async () => ({ id: member.discordId, roles: { cache: new Map([[recruit, {}]]) } })), member.discordId)).roleIds, [recruit]);
});

for (const key of ["OWNER", "MEMPHIS_LEADER", "PHOENIX_LEADER", "MEMPHIS_HIGH_STAFF", "PHOENIX_HIGH_STAFF", "MEMPHIS_DEP_OWNER", "PHOENIX_DEP_OWNER", "MEMPHIS_CUR_RECRUIT", "PHOENIX_CUR_RECRUIT", "MEMPHIS_RECRUIT", "PHOENIX_RECRUIT"]) {
  test(`${key}: grant/revoke triggers sync and role survives payload filtering`, () => {
    const roleId = FAMILY_RANKS.find(rank => rank.key === key)!.roleId;
    assert.equal(accessRolesChanged([], [roleId]), true);
    assert.equal(accessRolesChanged([roleId], []), true);
    const guildMember = { id: member.discordId, roles: { cache: new Map([[roleId, {}]]) } } as unknown as GuildMember;
    assert.deepEqual(observeAccess(guildMember, "ROLE_UPDATE").roleIds, [roleId]);
  });
}
test("ordinary ranks trigger FAMQ sync while service roles are filtered", () => {
  const ids = FAMILY_RANKS.filter(rank => ["MAIN", "LONDEST_LONDO", "LONDO", "YOUNG_LONDO", "BABY_LONDO", "NEWBIE"].includes(rank.key)).map(rank => rank.roleId);
  ids.push("999999999999999999");
  assert.equal(accessRolesChanged([], ids), true);
  assert.deepEqual(observeAccess({ id: member.discordId, roles: { cache: new Map(ids.map(id => [id, {}])) } } as unknown as GuildMember, "ROLE_UPDATE").roleIds, ids.slice(0,-1));
});

test("configured FAM and both membership roles trigger grant/revoke and survive snapshot filtering",()=>{
 const values={FAM_ROLE_ID:"1545123264626430067",MEMPHIS_ROLE_ID:"1545123264626430066",PHOENIX_ROLE_ID:"1545123264626430065"};
 const previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
 try{Object.assign(process.env,values);
  for(const roleId of Object.values(values)){
   assert.equal(accessRolesChanged([],[roleId]),true);assert.equal(accessRolesChanged([roleId],[]),true);
   assert.deepEqual(observeAccess({id:member.discordId,roles:{cache:new Map([[roleId,{}]])}} as unknown as GuildMember,"ROLE_UPDATE").roleIds,[roleId]);
  }
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
