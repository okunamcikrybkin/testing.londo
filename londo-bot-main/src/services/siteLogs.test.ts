import assert from "node:assert/strict";
import test from "node:test";
import type { SiteLogConfig } from "../config/siteLogs.js";
import { sendLogEvent } from "./siteLogs.js";

const config: SiteLogConfig = { apiSecret: "unit-test-value", siteUrl: "http://localhost:3000" };
const event = { metadata: { event: "BOT_STARTED", roleCount: 3 }, serverId: "111111111111111111", sourceEventId: "test-startup-1", summary: "LONDO Bot startup completed." };

test("sendLogEvent posts the site contract with the internal header", async () => {
  let request: { body?: string; headers?: Headers; method?: string; url?: string } = {};
  const success = await sendLogEvent(config, event, { fetchImplementation: async (url, init) => {
    request = { body: init?.body as string, headers: new Headers(init?.headers), method: init?.method, url: String(url) };
    return new Response(null, { status: 201 });
  } });
  assert.equal(success, true);
  assert.equal(request.url, "http://localhost:3000/api/internal/logs");
  assert.equal(request.method, "POST");
  assert.equal(request.headers?.get("x-londo-bot-secret"), "unit-test-value");
  assert.equal(request.headers?.get("content-type"), "application/json");
  const body = JSON.parse(request.body ?? "{}");
  assert.equal(body.type, "SYSTEM_EVENT");
  assert.equal(body.family, null);
  assert.equal(body.result, "SUCCESS");
  assert.deepEqual(body.metadata, event.metadata);
});

test("sendLogEvent handles HTTP failures without throwing", async () => {
  assert.equal(await sendLogEvent(config, event, { fetchImplementation: async () => new Response(null, { status: 401 }) }), false);
  assert.equal(await sendLogEvent(config, event, { fetchImplementation: async () => new Response(null, { status: 500 }) }), false);
});

test("sendLogEvent handles a network failure and timeout without retrying", async () => {
  assert.equal(await sendLogEvent(config, event, { fetchImplementation: async () => { throw new TypeError("connection refused"); } }), false);
  const timeoutResult = await sendLogEvent(config, event, { timeoutMs: 1, fetchImplementation: async (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))) });
  assert.equal(timeoutResult, false);
});
