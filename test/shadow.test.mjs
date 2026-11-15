import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";
import { rememberOriginal } from "../src/shadow.mjs";

function cut(targetId, text = "body") {
  return { targetId, toolCallId: targetId, toolName: "bash", text };
}

test("uses collision-safe target keys and preserves changed-body protection", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-lc-shadow-"));
  assert.equal(rememberOriginal(cut("a/b"), "session", root), "ok");
  assert.equal(rememberOriginal(cut("a_b"), "session", root), "ok");
  assert.equal(rememberOriginal(cut("a/b"), "session", root), "ok");
  assert.equal(rememberOriginal(cut("a/b", "changed"), "session", root), "mismatch");
  const dir = join(root, "v2", "sha-missing");
  const sessionDir = readdirSync(join(root, "v2"));
  assert.equal(sessionDir.length, 1);
  const files = readdirSync(join(root, "v2", sessionDir[0]));
  assert.equal(files.length, 2);
  const record = JSON.parse(readFileSync(join(root, "v2", sessionDir[0], files[0]), "utf8"));
  assert.ok(record.targetId === "a/b" || record.targetId === "a_b");
  assert.equal(existsSync(dir), false);
});

test("shadow write failures do not block a cut", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-lc-shadow-fail-"));
  const blocked = join(root, "blocked");
  writeFileSync(blocked, "file");
  assert.equal(rememberOriginal(cut("target"), "session", blocked), "ok");
});

test("a corrupt existing record keeps same-target protection fail-closed", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-lc-shadow-corrupt-"));
  assert.equal(rememberOriginal(cut("target"), "session", root), "ok");
  const sessionDir = readdirSync(join(root, "v2"))[0];
  const file = join(root, "v2", sessionDir, readdirSync(join(root, "v2", sessionDir))[0]);
  writeFileSync(file, "not-json");
  assert.equal(rememberOriginal(cut("target", "changed"), "session", root), "mismatch");
});
