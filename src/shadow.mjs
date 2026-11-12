import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export function shadowRoot(env = process.env) {
  return env.PI_LIVE_COMPACT_SHADOW || join(homedir(), ".pi", "agent", "live-compact", "shadow");
}

export function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

export function rememberOriginal(cut, sessionId, root = shadowRoot()) {
  const id = String(cut.toolCallId || "").replace(/[^A-Za-z0-9._-]/g, "_");
  if (!id || !sessionId) return "skip";
  const dir = join(root, String(sessionId).replace(/[^A-Za-z0-9._-]/g, "_"));
  const bodyPath = join(dir, `${id}.txt`);
  const metaPath = join(dir, `${id}.json`);
  const next = sha256(cut.text);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (existsSync(metaPath)) {
      const prior = JSON.parse(readFileSync(metaPath, "utf8"));
      if (prior.sha256 === next) return "ok";
      return "mismatch";
    }
    writeFileSync(bodyPath, cut.text, { mode: 0o600, flag: "wx" });
    writeFileSync(metaPath, JSON.stringify({ sha256: next, toolName: cut.toolName, toolCallId: cut.toolCallId }), {
      mode: 0o600,
      flag: "wx",
    });
    return "ok";
  } catch {
    return "skip";
  }
}
