import { selectCuts, applyShadowGate, textOf, estimateTokens, BIG_GATE, shouldDrain } from "./plan.mjs";
import { rememberOriginal } from "./shadow.mjs";

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

function projectedTokens(ctx, entries) {
  const usage = ctx.getContextUsage?.();
  if (usage && Number.isFinite(usage.tokens)) return usage.tokens;
  return entries.reduce((sum, entry) => sum + estimateTokens(textOf(entry.message?.content)), 0);
}

function usageOf(ctx) {
  const usage = ctx.getContextUsage?.();
  if (!usage || !Number.isFinite(usage.tokens)) return null;
  return usage;
}

function cutsFor(ctx) {
  const projection = ctx.sessionManager?.buildSessionProjection?.();
  const entries = itemsFromProjection(projection);
  if (!entries.length) return [];
  const usage = usageOf(ctx);
  const totalTokens = usage?.tokens ?? projectedTokens(ctx, entries);
  if (!shouldDrain(totalTokens) || totalTokens >= BIG_GATE) return [];
  const sessionId = ctx.sessionManager.getSessionId?.() || "session";
  return applyShadowGate(selectCuts(entries, { totalTokens, drain: true }), (cut) => rememberOriginal(cut, sessionId));
}

export default function piLiveCompact(pi) {
  pi.on("turn_end", (event, ctx) => {
    try {
      if (event?.outcome && event.outcome !== "completed") return;
      const accepted = cutsFor(ctx);
      if (!accepted.length) return;
      return {
        entries: [
          ...(event.entries || []),
          ...accepted.map((cut) => ({
            type: "context_edit",
            targetId: cut.targetId,
            replacement: { content: cut.cardText },
          })),
        ],
      };
    } catch {
      return;
    }
  });
}
