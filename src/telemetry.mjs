import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export function telemetryPath(env = process.env) {
  return env.PI_LIVE_COMPACT_LOG || join(homedir(), ".pi", "agent", "live-compact", "events.jsonl");
}

export function logEvent(event, env = process.env) {
  try {
    const file = telemetryPath(env);
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    appendFileSync(file, `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`, { mode: 0o600 });
  } catch {
    // Telemetry must never affect compaction or the host turn.
  }
}
