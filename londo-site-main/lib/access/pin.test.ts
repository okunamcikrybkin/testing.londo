import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { hashPin, verifyPinHash } from "./pin-crypto";
import { validPin, safeStaffNext, intersectScopes, canRequestScopes, isStaffPage } from "./policy";
import { sessionStaffState } from "./session-policy";
for (const pin of ["0000","0042","1234","9999"]) test(`PIN preserves ${pin.length} digits including leading zeros: ${pin.slice(0,1)}***`,()=>assert.equal(validPin(pin),true));
for (const pin of ["123","12345","12A4"," 1234","1234 ","","１２３４",1234]) test(`invalid PIN format ${typeof pin}/${String(pin).length}`,()=>assert.equal(validPin(pin),false));
test("salted scrypt hash verifies without storing plaintext; wrong PIN and hash fail",async()=>{
  const original=process.env.STAFF_PIN_PEPPER;process.env.STAFF_PIN_PEPPER=randomBytes(32).toString("hex");
  try {const first=await hashPin("0042"),second=await hashPin("0042");assert.notEqual(first,"0042");assert.notEqual(first,second);assert.equal(await verifyPinHash("0042",first),true);assert.equal(await verifyPinHash("1234",first),false);assert.equal(await verifyPinHash("0042","malformed"),false);}finally{if(original===undefined)delete process.env.STAFF_PIN_PEPPER;else process.env.STAFF_PIN_PEPPER=original;}
});
test("PIN authorization belongs to one session and current credential version/grant",()=>{
  const user={role:"RECRUIT" as const,staffAccessGrants:[{role:"RECRUIT" as const,memphisRole:"USER" as const,phoenixRole:"RECRUIT" as const}],staffAccessCredential:{pinSetAt:new Date(),credentialVersion:1}};
  const fresh={user,staffPinVerifiedAt:null,staffPinCredentialVersion:null};
  assert.equal(sessionStaffState(fresh,false).role,"USER");assert.equal(sessionStaffState(fresh,false).pinRequired,true);
  const verified={...fresh,staffPinVerifiedAt:new Date(),staffPinCredentialVersion:1};
  assert.equal(sessionStaffState(verified,false).role,"RECRUIT");assert.deepEqual(sessionStaffState(verified,false).familyAccess,{MEMPHIS:"USER",PHOENIX:"RECRUIT"});
  assert.equal(sessionStaffState(fresh,false).pinRequired,true,"new login requires PIN again");
  assert.equal(sessionStaffState({...verified,user:{...user,staffAccessCredential:{pinSetAt:null,credentialVersion:2}}},false).role,"USER");
  assert.equal(sessionStaffState({...verified,user:{...user,staffAccessGrants:[]}},false).role,"USER");
  assert.equal(sessionStaffState(fresh,true).pinRequired,false,"FULL_ACCESS exempt");
});
test("scope addition requires request; Discord can only intersect granted scopes",()=>{
  const granted={memphisRole:"HIGH_STAFF" as const,phoenixRole:"USER" as const};
  const eligible={memphisRole:"RECRUIT" as const,phoenixRole:"HIGH_STAFF" as const};
  assert.deepEqual(intersectScopes(granted,eligible),{memphisRole:"RECRUIT",phoenixRole:"USER"});
  assert.equal(canRequestScopes(granted,eligible),true);
  assert.equal(canRequestScopes(granted,granted),false);
});
test("PIN next allows internal pages only; public profile remains accessible",()=>{
  for(const path of ["https://evil.test","//evil.test","/\\evil.test","/%2f%2fevil.test","/api/auth/sign-out","/access/pin/setup","/\n/evil.test"])assert.equal(safeStaffNext(path),"/dashboard");
  assert.equal(safeStaffNext("/applications/memphis?id=123"),"/applications/memphis?id=123");
  for(const path of ["/profile","/profile/customize","/access","/access/pin/verify","/roulette"])assert.equal(isStaffPage(path),false);
  for(const path of ["/dashboard","/giveaways","/access/manage","/settings/rank-colors","/shop","/applications/memphis","/logs","/memphis/roster","/promotions/admin","/roulette/admin"])assert.equal(isStaffPage(path),true);
});

