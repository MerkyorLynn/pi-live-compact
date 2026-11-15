import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { logEvent } from "./telemetry.mjs";

export function shadowRoot(env = process.env) {
  return env.PI_LIVE_COMPACT_SHADOW || join(homedir(), ".pi", "agent", "live-compact", "shadow");
}

export function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

export function rememberOriginal(cut, sessionId, root = shadowRoot()) {
  const targetId = String(cut.targetId || cut.toolCallId || "");
  if (!targetId) {
    logEvent({ event: "shadow", result: "unavailable", reason: "missing_target" });
    return "ok";
  }
  if (!sessionId) {
    logEvent({ event: "shadow", result: "unavailable", targetId, reason: "missing_session" });
    return "ok";
  }
  const sessionKey = sha256(String(sessionId)).slice(0, 32);
  const targetKey = sha256(`${sessionId}\0${targetId}`).slice(0, 32);
  const dir = join(root, "v2", sessionKey);
  const filePath = join(dir, `${targetKey}.json`);
  const next = sha256(cut.text);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (existsSync(filePath)) {
      let prior;
      try {
        prior = JSON.parse(readFileSync(filePath, "utf8"));
      } catch (error) {
        logEvent({ event: "shadow", result: "mismatch", targetId, reason: `invalid_existing_record:${String(error?.message || error)}` });
        return "mismatch";
      }
      if (prior.targetId === targetId && prior.sha256 === next) return "ok";
      if (prior.targetId === targetId && prior.sha256 !== next) {
        logEvent({ event: "shadow", result: "mismatch", targetId });
        return "mismatch";
      }
      logEvent({ event: "shadow", result: "unavailable", targetId, reason: "invalid_existing_record" });
      return "mismatch";
    }
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmpPath, JSON.stringify({
      targetId,
      toolName: cut.toolName,
      toolCallId: cut.toolCallId,
      sha256: next,
      text: cut.text,
    }), { mode: 0o600, flag: "wx" });
    renameSync(tmpPath, filePath);
    return "ok";
  } catch (error) {
    logEvent({ event: "shadow", result: "unavailable", targetId, reason: String(error?.message || error) });
    return "ok";
  }
}
