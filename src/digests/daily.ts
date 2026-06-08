import type { IntelSignal } from "../types.js";

export function selectDailyDigestSignals(signals: IntelSignal[], limit = 5): IntelSignal[] {
  return [...signals]
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, limit);
}
