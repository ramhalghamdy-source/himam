import type { DigitalMetrics } from '../types/assessment';

export type DigitalScoringInput = {
  correctTargets: number;
  targetAttempts: number;
  correctDrops: number;
  dropAttempts: number;
  correctKeypresses: number;
  keypressAttempts: number;
  elapsedSeconds: number;
  paceReferenceSeconds?: number;
};

const clamp100 = (value: number) => Math.max(0, Math.min(100, value));

export function scoreDigitalWork(input: DigitalScoringInput): DigitalMetrics {
  const paceReference = input.paceReferenceSeconds ?? 60;

  const targetAccuracy = input.targetAttempts > 0
    ? clamp100((input.correctTargets / input.targetAttempts) * 100)
    : 0;

  const dragSuccess = input.dropAttempts > 0
    ? clamp100((input.correctDrops / input.dropAttempts) * 100)
    : 0;

  const typingAccuracy = input.keypressAttempts > 0
    ? clamp100((input.correctKeypresses / input.keypressAttempts) * 100)
    : 0;

  const pace = input.elapsedSeconds > 0
    ? clamp100((paceReference / input.elapsedSeconds) * 100)
    : 0;

  const digitalControlScore = Math.round(
    0.4 * targetAccuracy +
      0.25 * dragSuccess +
      0.2 * typingAccuracy +
      0.15 * pace,
  );

  return {
    targetAccuracy: Math.round(targetAccuracy),
    dragSuccess: Math.round(dragSuccess),
    typingAccuracy: Math.round(typingAccuracy),
    pace: Math.round(pace),
    digitalControlScore,
    elapsedSeconds: Math.round(input.elapsedSeconds * 10) / 10,
    correctTargets: input.correctTargets,
    totalTargets: 6,
    correctDrops: input.correctDrops,
    totalDrops: 3,
  };
}
