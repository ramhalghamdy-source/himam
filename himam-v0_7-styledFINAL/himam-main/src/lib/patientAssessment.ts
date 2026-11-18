import type { DigitalMetrics, HandMetrics, ReachMetrics } from '../types/assessment';
import type { FunctionalProfile } from './readiness';

/**
 * Patient condition assessment (HIMAM v0.7).
 *
 * A transparent, rule-based summary of the four functional domains plus a few
 * movement-quality flags. It describes TASK PERFORMANCE only. It is not a
 * diagnosis, a disability rating or a fitness-for-work decision, and every
 * threshold below is a prototype assumption that needs clinical validation.
 */

export type DomainKey = keyof FunctionalProfile;
export type StatusTier = 'strong' | 'good' | 'support' | 'intensive';
export type FlagId =
  | 'trunk'
  | 'reachIncomplete'
  | 'inconsistent'
  | 'pinch'
  | 'precision'
  | 'transfer'
  | 'digitalPace'
  | 'typing'
  | 'gap';
export type FlagSeverity = 'watch' | 'attention';

export type DomainStatus = { key: DomainKey; score: number; tier: StatusTier };
export type PatientFlag = { id: FlagId; severity: FlagSeverity; value: number };

export type PatientAssessmentResult = {
  index: number;
  tier: StatusTier;
  domains: DomainStatus[];
  strengths: DomainKey[];
  focus: DomainKey[];
  flags: PatientFlag[];
  weeklyGoal: number;
  reassessWeeks: number;
  therapistReview: boolean;
};

const TIER_ORDER: StatusTier[] = ['strong', 'good', 'support', 'intensive'];

/** Same cut-offs as the Work Readiness labels so the two views never disagree. */
export function tierOf(score: number): StatusTier {
  if (score >= 80) return 'strong';
  if (score >= 65) return 'good';
  if (score >= 45) return 'support';
  return 'intensive';
}

const rank = (tier: StatusTier) => TIER_ORDER.indexOf(tier);

export function assessPatient(
  profile: FunctionalProfile,
  reach: ReachMetrics,
  hand: HandMetrics,
  digital: DigitalMetrics,
): PatientAssessmentResult {
  const keys: DomainKey[] = ['reach', 'hand', 'coordination', 'digital'];
  const domains: DomainStatus[] = keys.map((key) => ({
    key,
    score: profile[key],
    tier: tierOf(profile[key]),
  }));

  const index = Math.round(keys.reduce((sum, key) => sum + profile[key], 0) / keys.length);
  const lowest = Math.min(...keys.map((key) => profile[key]));
  const highest = Math.max(...keys.map((key) => profile[key]));

  // Overall tier follows the index, but one very weak domain pulls it down one step.
  let tierRank = rank(tierOf(index));
  if (rank(tierOf(lowest)) - tierRank >= 2) tierRank = Math.min(tierRank + 1, TIER_ORDER.length - 1);
  const tier = TIER_ORDER[tierRank];

  const strengths = domains.filter((d) => d.score >= 80).map((d) => d.key);
  const focus = [...domains]
    .filter((d) => d.score < 65)
    .sort((a, b) => a.score - b.score)
    .map((d) => d.key);

  const flags: PatientFlag[] = [];
  const add = (id: FlagId, value: number, attentionBelow: number, watchBelow: number, higherIsWorse = false) => {
    const bad = higherIsWorse ? value >= watchBelow : value < watchBelow;
    if (!bad) return;
    const severe = higherIsWorse ? value >= attentionBelow : value < attentionBelow;
    flags.push({ id, value, severity: severe ? 'attention' : 'watch' });
  };

  add('trunk', reach.bodyStability, 55, 70);
  add('reachIncomplete', reach.completion, 60, 80);
  add('inconsistent', reach.consistency, 45, 60);
  add('pinch', hand.pinchControl, 45, 60);
  add('precision', hand.endpointPrecision, 45, 60);
  add('transfer', hand.transferSuccess, 60, 80);
  add('digitalPace', digital.pace, 40, 60);
  add('typing', digital.typingAccuracy, 70, 85);
  add('gap', highest - lowest, 45, 30, true);

  flags.sort((a, b) => Number(b.severity === 'attention') - Number(a.severity === 'attention'));

  const attentionCount = flags.filter((f) => f.severity === 'attention').length;
  const therapistReview = tier === 'intensive' || attentionCount >= 2;

  const weeklyGoal = { strong: 3, good: 4, support: 5, intensive: 5 }[tier];
  const reassessWeeks = { strong: 4, good: 3, support: 2, intensive: 2 }[tier];

  return { index, tier, domains, strengths, focus, flags, weeklyGoal, reassessWeeks, therapistReview };
}
