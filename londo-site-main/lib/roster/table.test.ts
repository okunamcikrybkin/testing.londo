import { test } from "node:test";
import assert from "node:assert/strict";
import { FAMILY_RANKS } from "../rank-appearance/catalog";
import type { RosterEntry } from "./data";
import { selectRoster, nextRosterSort, DEFAULT_SORT, compareDecimal, ROSTER_COLUMNS } from "./table";
const row = (id: string, nickname: string, overrides: Partial<RosterEntry> = {}): RosterEntry => ({ discordUserId: id, gameNickname: nickname, discordDisplayName: nickname, username: nickname, birthday: null, profileId: id, staticId: null, rankDisplayName: null, rankPriority: null, totalVoiceSeconds: BigInt(0), balance: "0", ...overrides });
const a = row("1545123264643479265", "Vafelion", {staticId:"288125", rankDisplayName:"Londo", rankRoleId:"1545123264643473519", balance:"2004053.7296", totalVoiceSeconds:BigInt(6720)});
const b = row("1545123264643479266", "Other", {staticId:"566", rankDisplayName:"Londest Londo", balance:"3.7296"});
test("partial case-insensitive search across names, static, Discord and rank", () => {
  for (const q of ["vaf", " VAF ", "881", "9265"]) assert.deepEqual(selectRoster([a,b],q).map(r=>r.discordUserId),[a.discordUserId]);
  assert.equal(selectRoster([a,b],"lon").length,2);
  assert.equal(selectRoster([a,b],"566")[0],b);
  assert.equal(selectRoster([a,b],"missing").length,0);
});
test("canonical hierarchy uses both family role IDs; unranked last in both directions", () => {
  const rows=FAMILY_RANKS.map((r,i)=>row(String(i+1),r.label,{rankRoleId:r.roleId,rankDisplayName:r.label}));
  const unranked=row("999","AAA");
  for(const direction of ["asc","desc"] as const){
    const result=selectRoster([unranked,...rows.reverse()],"",{key:"rank",direction});
    assert.equal(result.at(-1),unranked);
    const priorities=result.slice(0,-1).map(r=>FAMILY_RANKS.find(x=>x.roleId===r.rankRoleId)!.priority);
    assert.deepEqual(priorities,[...priorities].sort((a,b)=>direction==="desc"?b-a:a-b));
  }
  assert.equal(selectRoster(rows,"")[0].rankDisplayName,"Owner");
});
test("numeric static, raw voice seconds, exact decimal balances and snowflakes",()=>{
  for(const key of ["static","voice","coins"] as const) assert.equal(selectRoster([b,a],"",{key,direction:"desc"})[0],a);
  assert.equal(selectRoster([a,b],"",{key:"discord",direction:"desc"})[0],b);
  assert.equal(compareDecimal("9007199254740993.0001","9007199254740993.0000"),1);
  assert.equal(compareDecimal("1e+21","999999999999999999999"),1);
  assert.equal(compareDecimal("-0.01","0"),-1);
  for(const direction of ["asc","desc"] as const) assert.equal(selectRoster([row("1","AAA"),a,b],"",{key:"static",direction}).at(-1)?.discordUserId,"1");
});
test("each header toggles direction and new name sort starts ascending",()=>{
  for(const {key} of ROSTER_COLUMNS){ const first=nextRosterSort({key:key==="name"?"rank":"name",direction:"asc"},key); assert.equal(first.direction,key==="name"?"asc":"desc"); assert.notEqual(nextRosterSort(first,key).direction,first.direction); }
  assert.equal(nextRosterSort(DEFAULT_SORT,"rank").direction,"asc");
});
test("ties resolve by nickname then exact Discord ID regardless of polling order",()=>{
  const rows=[row("9007199254740993","Same"),row("9007199254740992","Same"),row("4","Alpha")];
  for(const direction of ["asc","desc"] as const) assert.deepEqual(selectRoster(rows,"",{key:"coins",direction}).map(r=>r.discordUserId),["4","9007199254740992","9007199254740993"]);
  assert.deepEqual(selectRoster(rows,""),selectRoster([...rows].reverse(),""));
});
test("search and selected sort remain applicable to refreshed data without mutating roster",()=>{
  const rows=[b,a], copy=[...rows], sort={key:"coins",direction:"desc"} as const;
  assert.equal(selectRoster(rows,"lon",sort)[0],a);
  assert.deepEqual(rows,copy);
  const updated={...b,balance:"3000000"};
  assert.equal(selectRoster([a,updated],"lon",sort)[0],updated);
});
