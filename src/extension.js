import { selectCuts, applyShadowGate, BIG_GATE, resolveStartTokens, shouldDrain } from "./plan.mjs";
import { rememberOriginal } from "./shadow.mjs";
import { logEvent } from "./telemetry.mjs";

function itemsFromProjection(projection) {
  if (!projection || !Array.isArray(projection.entries)) return [];
  return projection.entries.map((entry, index) => {
    const message = Array.isArray(entry.messages) ? entry.messages[0] : entry.message;
    return {
      index,
      sourceId: entry.sourceEntry?.id || entry.sourceId,
      message,
    };
  }).filter((entry) => entry.message);
}

function projectionHasCompaction(projection) {
  return Array.isArray(projection?.entries) && projection.entries.some((entry) => (
    entry.sourceEntry?.type === "compaction"
    || entry.sourceEntry?.type === "compactionSummary"
    || entry.sourceEntry?.type === "branch_summary"
    || entry.message?.role === "compactionSummary"
    || entry.message?.role === "branchSummary"
    || (Array.isArray(entry.messages) && entry.messages.some((message) => message?.role === "compactionSummary" || message?.role === "branchSummary"))
  ));
}

function usageOf(ctx) {
  const usage = ctx.getContextUsage?.();
  if (!usage || !Number.isFinite(usage.tokens) || !Number.isFinite(usage.contextWindow)) return null;
  return usage;
}

function cutsFor(event, ctx) {
  const projection = Array.isArray(event?.context?.contextEntries)
    ? { entries: event.context.contextEntries }
    : ctx.sessionManager?.buildSessionProjection?.();
  const entries = itemsFromProjection(projection);
  if (!entries.length) return { accepted: [], candidates: 0, reason: "empty_projection" };
  const usage = usageOf(ctx);
  if (!usage) return { accepted: [], candidates: 0, reason: "usage_unknown" };
  const startTokens = resolveStartTokens(usage.contextWindow);
  if (!shouldDrain(usage.tokens, false, startTokens)) return { accepted: [], candidates: 0, reason: "below_start" };
  const compacted = projectionHasCompaction(projection);
  if (compacted && !entries.some((entry) => entry.message?.role === "user")) {
    return { accepted: [], candidates: 0, usage, startTokens, reason: "compacted_no_user" };
  }
  const candidates = selectCuts(entries, {
    totalTokens: usage.tokens,
    drain: true,
    startTokens,
    bigGate: Number.isFinite(usage.contextWindow) ? Infinity : BIG_GATE,
    compacted,
  });
  const sessionId = ctx.sessionManager?.getSessionId?.();
  const accepted = applyShadowGate(candidates, (cut) => rememberOriginal(cut, sessionId));
  return { accepted, candidates: candidates.length, usage, startTokens, reason: "evaluated" };
}

export default function piLiveCompact(pi) {
  let skipAfterCompact = false;
  pi.on("session_start", () => {
    skipAfterCompact = false;
  });
  pi.on("session_compact", (event) => {
    skipAfterCompact = true;
    logEvent({ event: "compact", reason: event?.reason || "unknown", willRetry: event?.willRetry === true });
  });
  pi.on("session_compact_failed", (event) => {
    skipAfterCompact = true;
    logEvent({ event: "compact_failed", reason: event?.reason || "unknown", aborted: event?.aborted === true, willRetry: event?.willRetry === true, error: String(event?.errorMessage || "").slice(0, 500) });
  });
  pi.on("turn_end", (event, ctx) => {
    try {
      if (skipAfterCompact) {
        skipAfterCompact = false;
        logEvent({ event: "turn", result: "skip", reason: "after_compact" });
        return;
      }
      if (event?.outcome && event.outcome !== "completed") {
        logEvent({ event: "turn", result: "skip", reason: `outcome_${event.outcome}` });
        return;
      }
      if (event?.message?.stopReason === "length") {
        logEvent({ event: "turn", result: "skip", reason: "stop_length" });
        return;
      }
      const result = cutsFor(event, ctx);
      const usage = result.usage;
      logEvent({
        event: "turn",
        result: result.reason,
        reason: result.reason,
        tokens: usage?.tokens ?? null,
        contextWindow: usage?.contextWindow ?? null,
        startTokens: result.startTokens ?? null,
        candidates: result.candidates,
        accepted: result.accepted.length,
      });
      if (!result.accepted.length) return;
      return {
        entries: [
          ...(event.entries || []),
          ...result.accepted.map((cut) => ({
            type: "context_edit",
            targetId: cut.targetId,
            replacement: { content: cut.cardText },
          })),
        ],
      };
    } catch (error) {
      logEvent({ event: "error", error: String(error?.stack || error) });
      return;
    }
  });
}
