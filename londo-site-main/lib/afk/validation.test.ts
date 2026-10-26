import test from "node:test";import assert from "node:assert/strict";import {afkEnd,afkReason,afkFamily} from "./validation";
test("duration is server validated, with a 24-hour maximum",()=>{const now=new Date("2026-09-05T10:00:00Z");assert.equal(+afkEnd("1440",now)-+now,86400000);for(const value of ["0","1441","-1","NaN","2 hours","2026-09-06T11:00:00Z",null])assert.throws(()=>afkEnd(value,now));});
test("rejection/application reason is required, trimmed and bounded",()=>{assert.equal(afkReason("  отпуск  "),"отпуск");for(const value of ["  ",null,"x".repeat(1001)])assert.throws(()=>afkReason(value));});
test("family input must be a supported family",()=>{assert.equal(afkFamily("MEMPHIS"),"MEMPHIS");assert.equal(afkFamily("PHOENIX"),"PHOENIX");assert.throws(()=>afkFamily("ALL"));});
