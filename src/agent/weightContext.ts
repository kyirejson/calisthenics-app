import type { Profile } from '../types';
import { weightTrendWindow } from '../data/weightTrend';

/** Two disjoint calendar weeks, with one valid measurement per date and no interpolation. */
export function agentWeightContext(profile: Profile, now = new Date()) {
  const previousEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 12);
  const recent = weightTrendWindow(profile.weightHistory, 7, now);
  const previous = weightTrendWindow(profile.weightHistory, 7, previousEnd);
  const recentMean = recent.average ?? null, previousMean = previous.average ?? null;
  const enough = recent.records.length >= 5 && previous.records.length >= 5;
  const comparison: 'insufficient' | 'stable' | 'changed' = !enough ? 'insufficient'
    : Math.abs(recentMean! - previousMean!) <= .200001 ? 'stable' : 'changed';
  return { end: recent.end, recentCount: recent.records.length, previousCount: previous.records.length, recentMean, previousMean, comparison };
}
export type AgentWeightContext = ReturnType<typeof agentWeightContext>;
