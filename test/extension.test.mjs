import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import piLiveCompact from "../src/extension.js";

const root = mkdtempSync(join(tmpdir(), "pi-lc-extension-"));
process.env.PI_LIVE_COMPACT_SHADOW = join(root, "shadow");
process.env.PI_LIVE_COMPACT_LOG = join(root, "events.jsonl");
process.env.PI_LIVE_COMPACT_START = "20000";

function user(id) {
  return { sourceEntry: { id: `user-${id}` }, messages: [{ role: "user", content: id }] };
}

function round(id, text = "x".repeat(8000)) {
  return [
    {
      sourceEntry: { id: `${id}-assistant` },
      messages: [{ role: "assistant", content: [{ type: "toolCall", id, name: "bash", arguments: { command: id } }] }],
    },
    {
      sourceEntry: { id },
      messages: [{ role: "toolResult", toolCallId: id, toolName: "bash", content: [{ type: "text", text }], isError: false }],
    },
  ];
}

function contextEntries() {
  return [
    user("old"),
    ...round("old-1"),
    ...round("old-2"),
    ...round("old-3"),
    ...round("old-4"),
    user("current"),
    ...round("current-1", "short"),
  ];
}

function setup() {
  const handlers = {};
  piLiveCompact({ on(name, handler) { handlers[name] = handler; } });
  const ctx = {
    getContextUsage: () => ({ tokens: 20000, contextWindow: 200000 }),
    sessionManager: {
      getSessionId: () => "extension-test-session",
      buildSessionProjection: () => { throw new Error("event context should be used"); },
    },
  };
  return { handlers, ctx };
}

test("uses the boundary projection and returns a context edit", async () => {
  const { handlers, ctx } = setup();
  const result = await handlers.turn_end({
    outcome: "completed",
    message: { stopReason: "toolUse" },
    entries: [],
    context: { contextEntries: contextEntries() },
  }, ctx);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries.map((entry) => entry.type), ["context_edit", "context_edit"]);
  assert.deepEqual(result.entries.map((entry) => entry.targetId), ["old-1", "old-2"]);
});

test("fails closed when usage is unknown", async () => {
  const { handlers, ctx } = setup();
  const result = await handlers.turn_end({
    outcome: "completed",
    message: { stopReason: "toolUse" },
    entries: [],
    context: { contextEntries: contextEntries() },
  }, { ...ctx, getContextUsage: () => ({ tokens: null, contextWindow: 200000 }) });
  assert.equal(result, undefined);
});

test("skips the turn after native compaction and length stops", async () => {
  const { handlers, ctx } = setup();
  await handlers.session_compact({ reason: "threshold", willRetry: false }, ctx);
  const afterCompact = await handlers.turn_end({ outcome: "completed", message: { stopReason: "toolUse" }, entries: [], context: { contextEntries: contextEntries() } }, ctx);
  assert.equal(afterCompact, undefined);
  const length = await handlers.turn_end({ outcome: "completed", message: { stopReason: "length" }, entries: [], context: { contextEntries: contextEntries() } }, ctx);
  assert.equal(length, undefined);
});

test("keeps skipping a split-turn projection until a new user message", async () => {
  const { handlers, ctx } = setup();
  const noUser = [
    { sourceEntry: { id: "compact", type: "compaction" }, messages: [{ role: "compactionSummary", content: "summary" }] },
    ...contextEntries().filter((entry) => entry.messages?.[0]?.role !== "user"),
  ];
  await handlers.session_compact({ reason: "threshold", willRetry: false }, ctx);
  assert.equal(await handlers.turn_end({ outcome: "completed", message: { stopReason: "toolUse" }, entries: [], context: { contextEntries: noUser } }, ctx), undefined);
  assert.equal(await handlers.turn_end({ outcome: "completed", message: { stopReason: "toolUse" }, entries: [], context: { contextEntries: noUser } }, ctx), undefined);
  const resumed = await handlers.turn_end({ outcome: "completed", message: { stopReason: "toolUse" }, entries: [], context: { contextEntries: contextEntries() } }, ctx);
  assert.ok(resumed?.entries?.length);
});

test("does not leave compaction state stuck after an error turn", async () => {
  const { handlers, ctx } = setup();
  const noUser = [
    { sourceEntry: { id: "compact", type: "compaction" }, messages: [{ role: "compactionSummary", content: "summary" }] },
    ...contextEntries().filter((entry) => entry.messages?.[0]?.role !== "user"),
  ];
  await handlers.session_compact({ reason: "threshold", willRetry: false }, ctx);
  assert.equal(await handlers.turn_end({ outcome: "error", message: { stopReason: "error" }, entries: [], context: { contextEntries: noUser } }, ctx), undefined);
  assert.equal(await handlers.turn_end({ outcome: "completed", message: { stopReason: "toolUse" }, entries: [], context: { contextEntries: noUser } }, ctx), undefined);
});

test("writes bounded telemetry without affecting the handler", async () => {
  const events = readFileSync(process.env.PI_LIVE_COMPACT_LOG, "utf8").trim().split("\n").map(JSON.parse);
  assert.ok(events.some((event) => event.event === "turn"));
  assert.ok(events.some((event) => event.reason === "usage_unknown"));
  assert.ok(events.some((event) => event.reason === "after_compact"));
  assert.ok(events.some((event) => event.reason === "compacted_no_user"));
  const { handlers, ctx } = setup();
  await handlers.turn_end({ outcome: "completed", message: { stopReason: "length" }, entries: [], context: { contextEntries: contextEntries() } }, ctx);
  await handlers.session_compact_failed({ reason: "overflow", errorMessage: "test failure", aborted: false, willRetry: false }, ctx);
  const updated = readFileSync(process.env.PI_LIVE_COMPACT_LOG, "utf8").trim().split("\n").map(JSON.parse);
  assert.ok(updated.some((event) => event.reason === "stop_length"));
  assert.ok(updated.some((event) => event.event === "compact_failed" && event.error === "test failure"));
});
