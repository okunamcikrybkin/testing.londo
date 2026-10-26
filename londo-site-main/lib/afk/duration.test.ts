import test from "node:test";
import assert from "node:assert/strict";
import { afkEnd, afkErrors } from "./validation";
import { categoryLabel, logActionLabel } from "../logs/contract";
const now = new Date("2026-09-06T10:00:00Z"); // 12:00 Europe/Berlin
test("vacation relative formats preserve the existing 24-hour limit", () => {
  for (const [input, minutes] of [["10m",10],["2h",120],["1d",1440],["60",60],[" 2H ",120]] as const) assert.equal(+afkEnd(input,now)-+now,minutes*60000);
  for (const input of ["3d","25h","1441m","0m","-2h","1.5h","999999999999999999999d"]) assert.throws(()=>afkEnd(input,now),/INVALID_DURATION/);
});
test("full date, short date and time-only are interpreted in Europe/Berlin", () => {
  for(const input of ["13:30 06.09.2026","13:30 06.09","13:30"]) assert.equal(afkEnd(input,now).toISOString(),"2026-09-06T11:30:00.000Z");
  assert.equal(afkEnd("10:00",now).toISOString(),"2026-09-07T08:00:00.000Z");
  assert.equal(afkEnd("2026-09-06T13:30:00+02:00",now).toISOString(),"2026-09-06T11:30:00.000Z");
});
test("invalid or past calendar dates never silently normalize", () => {
  for(const input of ["24:00","12:60","9:00","12:00 31.02.2026","12:00 31.04","13:30 00.09","13:30 06.13","09:00 06.09.2026","2026-02-30T13:00:00Z","tomorrow",null]) assert.throws(()=>afkEnd(input,now));
});
test("yearless dates cross New Year using the next future occurrence", () => {
  assert.equal(afkEnd("10:00 01.01",new Date("2026-12-31T12:00:00Z")).toISOString(),"2027-01-01T09:00:00.000Z");
});
test("DST gap is rejected and repeated hour resolves to next matching instant", () => {
  assert.throws(()=>afkEnd("02:30 29.03.2026",new Date("2026-03-28T23:00:00Z")));
  assert.equal(afkEnd("02:30 25.10.2026",new Date("2026-10-24T23:00:00Z")).toISOString(),"2026-10-25T00:30:00.000Z");
  assert.equal(afkEnd("02:30 25.10.2026",new Date("2026-10-25T00:45:00Z")).toISOString(),"2026-10-25T01:30:00.000Z");
});
test("validation and log presentation use vacation wording with examples", () => {
  assert.equal(afkErrors.INVALID_DURATION,"Неверный срок отпуска.\nПримеры: 30m, 2h, 18:30, 18:30 07.09.\nМаксимум — 24 часа.");
  for(const message of Object.values(afkErrors)) assert.doesNotMatch(message,/AFK/);
  assert.equal(categoryLabel("AFK"),"Отпуск");
  assert.equal(logActionLabel("AFK_ENDED"),"Отпуск завершён");
  assert.equal(logActionLabel("SHOP_PURCHASE_CREATED"),"SHOP_PURCHASE_CREATED");
});


test("reported modal date values accept padded and unpadded day/month within 24 hours", () => {
  const reference = new Date("2026-09-06T16:07:00.123Z"); // Berlin 18:07
  for (const input of ["18:00 07.09", "18:00 7.9", "18:00 07.09.2026", "18:00 7.9.2026", " 18:00 7.9 "]) {
    assert.equal(afkEnd(input, reference).toISOString(), "2026-09-07T16:00:00.000Z", input);
  }
});
test("all required relative durations accept inclusive one-minute and 24-hour boundaries", () => {
  for (const reference of [new Date("2026-09-06T16:07:01.789Z"),new Date("2026-03-28T16:00:00Z"),new Date("2026-10-24T16:00:00Z")]) {
    for (const [input, minutes] of [["1m",1],["10m",10],["30m",30],["1h",60],["2h",120],["12h",720],["24h",1440],[" 24h ",1440]] as const) {
      assert.equal(+afkEnd(input,reference)-+reference,minutes*60000,input);
    }
    for(const input of ["0m","0h","25h","3d","abc"]) assert.throws(()=>afkEnd(input,reference),/INVALID_DURATION/,input);
  }
});
test("calendar values distinguish correct syntax from the strict 24-hour range", () => {
  for(const input of ["18:00 07.09","18:00 7.9","18:00 07.09.2026"]) {
    assert.throws(()=>afkEnd(input,new Date("2026-09-06T15:59:59.999Z")),/INVALID_DURATION/); // >24h
    assert.equal(afkEnd(input,new Date("2026-09-06T16:00:00Z")).toISOString(),"2026-09-07T16:00:00.000Z");
    assert.throws(()=>afkEnd(input,new Date("2026-09-07T15:59:00.001Z")),/INVALID_DURATION/); // <1m
    assert.throws(()=>afkEnd(input,new Date("2026-09-07T16:01:00Z")),/INVALID_DURATION/); // past
  }
});
test("unpadded dates retain calendar validation and time-only rolls to tomorrow", () => {
  const reference=new Date("2026-09-06T17:00:00Z"); // Berlin 19:00
  assert.equal(afkEnd("18:30",reference).toISOString(),"2026-09-07T16:30:00.000Z");
  for(const input of ["18:00 31.2.2026","18:00 31.02.2026","18:00 0.9","18:00 7.13"]) assert.throws(()=>afkEnd(input,reference),/INVALID_DURATION/);
});
