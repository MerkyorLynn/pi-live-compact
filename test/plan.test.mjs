import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectCuts, applyShadowGate, estimateTokens, POINTER_TOKENS, BIG_GATE, CARD_MARK, resolveStartTokens, resolveGuardUserSpans } from "../src/plan.mjs";
import { rememberOriginal } from "../src/shadow.mjs";

function result(id, name, text, extra = {}) {
  return {
    sourceId: id,
    message: {
      role: "toolResult",
      toolCallId: extra.toolCallId || id,
      toolName: name,
      content: [{ type: "text", text }],
      isError: extra.isError === true,
    },
  };
}

function call(id, name) {
  return {
    sourceId: `${id}-call`,
    message: { role: "assistant", content: [{ type: "toolCall", id, name, arguments: {} }] },
  };
}

function round(id, name, text, extra) {
  return [call(id, name), result(id, name, text, extra)];
}

function multiRound(id, calls) {
  return [
    {
      sourceId: `${id}-assistant`,
      message: {
        role: "assistant",
        content: calls.map(({ callId, name }) => ({ type: "toolCall", id: callId, name, arguments: { command: `${name} ${callId}` } })),
      },
    },
    ...calls.map(({ callId, name, text }) => result(callId, name, text)),
  ];
}

function indexed(parts) {
  return parts.flat().map((entry, index) => ({ ...entry, index }));
}

test("keeps the last three tool rounds raw", () => {
  const text = "x".repeat(8000);
  const entries = indexed([1, 2, 3, 4].map((n) => round(`r${n}`, "bash", text)));
  const cuts = selectCuts(entries, { totalTokens: 48000 });
  assert.deepEqual(cuts.map((cut) => cut.targetId), ["r1"]);
});

test("skips a result under 1000 tokens instead of borrowing later rounds", () => {
  const short = "x".repeat(100);
  const entries = indexed([1, 2, 3, 4].map((n) => round(`r${n}`, "bash", short)));
  assert.equal(selectCuts(entries, { totalTokens: 1000 }).length, 0);
});

test("a long read is cut inside its own round", () => {
  const full = "log\n".repeat(2000);
  const entries = indexed([
    round("old", "read", full),
    round("keep1", "bash", "short"),
    round("keep2", "bash", "short"),
    round("keep3", "bash", "short"),
  ]);
  const cuts = selectCuts(entries, { totalTokens: 48000 });
  assert.deepEqual(cuts.map((cut) => cut.toolName), ["read"]);
  assert.equal(cuts[0].targetId, "old");
});

test("cuts every eligible long result in a mixed tool round", () => {
  const entries = indexed([
    user("上一题"),
    multiRound("mixed", [
      { callId: "mixed-read", name: "read", text: "r".repeat(8000) },
      { callId: "mixed-bash", name: "bash", text: "b".repeat(8000) },
    ]),
    ...[1, 2, 3].map((n) => round(`old${n}`, "bash", "old")),
    user("这一题"),
    ...[1, 2, 3].map((n) => round(`keep${n}`, "bash", "short")),
  ]);
  assert.deepEqual(selectCuts(entries, { totalTokens: 48000 }).map((cut) => cut.targetId), ["mixed-read", "mixed-bash"]);
});

test("does not cut left of the newest card", () => {
  const text = "x".repeat(8000);
  const entries = indexed([
    round("old", "bash", text),
    [{ sourceId: "card", message: { role: "toolResult", toolCallId: "card", toolName: "bash", content: [{ type: "text", text: `${CARD_MARK}\n已收` }], isError: false } }],
    round("mid", "bash", text),
    round("k1", "bash", "s"),
    round("k2", "bash", "s"),
    round("k3", "bash", "s"),
  ]);
  const cuts = selectCuts(entries, { totalTokens: 48000 });
  assert.deepEqual(cuts.map((cut) => cut.targetId), ["mid"]);
});

test("a 32000-token result becomes a pointer and a failed result stays whole", () => {
  const huge = "y".repeat(POINTER_TOKENS * 4);
  const entries = indexed([
    round("huge", "read", huge),
    round("bad", "bash", "z".repeat(8000), { isError: true }),
    round("k1", "bash", "s"),
    round("k2", "bash", "s"),
    round("k3", "bash", "s"),
  ]);
  const cuts = selectCuts(entries, { totalTokens: 48000 });
  assert.equal(cuts.length, 1);
  assert.equal(cuts[0].pointer, true);
  assert.match(cuts[0].cardText, /只留指针/);
  assert.ok(estimateTokens(huge) >= POINTER_TOKENS);
  assert.match(cuts[0].cardText, /参数/);
  assert.match(cuts[0].cardText, /开头/);
  assert.match(cuts[0].cardText, /重读/);
});

function user(text) {
  return [{ sourceId: `user-${text}`, message: { role: "user", content: text } }];
}

test("can protect the current user span when explicitly requested", () => {
  const text = "x".repeat(8000);
  const entries = indexed([
    user("上一题"),
    ...[1, 2, 3, 4].map((n) => round(`old${n}`, "bash", text)),
    user("这一题"),
    ...[1, 2, 3, 4].map((n) => round(`now${n}`, "bash", text)),
  ]);
  const cuts = selectCuts(entries, { totalTokens: 48000, guardUserSpans: 1 });
  assert.deepEqual(cuts.map((cut) => cut.targetId), ["old1"]);
});

test("cuts old rounds inside a single long user task while keeping the latest three", () => {
  const entries = indexed([
    user("single task"),
    ...[1, 2, 3, 4].map((n) => round(`single${n}`, "bash", "x".repeat(8000))),
  ]);
  assert.deepEqual(selectCuts(entries, { totalTokens: 48000 }).map((cut) => cut.targetId), ["single1"]);
});

test("does not cut before the 48000 urgent line", () => {
  const text = "x".repeat(8000);
  const entries = indexed([1, 2, 3, 4].map((n) => round(`r${n}`, "bash", text)));
  assert.equal(selectCuts(entries, { totalTokens: 47999 }).length, 0);
  assert.equal(selectCuts(entries, { totalTokens: 48000 }).length, 1);
});

test("stops small cuts at 650000", () => {
  const entries = indexed([1, 2, 3, 4].map((n) => round(`r${n}`, "bash", "x".repeat(8000))));
  assert.equal(selectCuts(entries, { totalTokens: BIG_GATE }).length, 0);
});

test("does not cut after compaction when the projection has no user boundary", () => {
  const entries = indexed([1, 2, 3, 4].map((n) => round(`r${n}`, "bash", "x".repeat(8000))));
  assert.equal(selectCuts(entries, { totalTokens: 48000, compacted: true }).length, 0);
});

test("resolves a configurable start line without changing the default constants", () => {
  assert.equal(resolveStartTokens(200000, {}), 48000);
  assert.equal(resolveStartTokens(200000, { PI_LIVE_COMPACT_START: "20000" }), 20000);
  assert.equal(resolveStartTokens(200000, { PI_LIVE_COMPACT_START: "0" }), 48000);
  assert.equal(resolveGuardUserSpans({}), 0);
  assert.equal(resolveGuardUserSpans({ PI_LIVE_COMPACT_GUARD_USER_SPANS: "1" }), 1);
});

test("identical replay is idempotent and a different body is not cut", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-lc-"));
  const cut = { toolCallId: "call-1", toolName: "read", text: "same body" };
  assert.equal(rememberOriginal(cut, "sess", root), "ok");
  assert.equal(rememberOriginal(cut, "sess", root), "ok");
  assert.equal(rememberOriginal({ ...cut, text: "other body" }, "sess", root), "mismatch");
  const accepted = applyShadowGate(
    [cut, { ...cut, toolCallId: "call-1", text: "other body" }, { toolCallId: "call-2", toolName: "bash", text: "new" }],
    (item) => rememberOriginal(item, "sess", root),
  );
  assert.deepEqual(accepted.map((item) => item.toolCallId), ["call-1", "call-2"]);
});
