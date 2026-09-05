import { clamp, coefficientOfVariation, mean } from './math';

export type ReachScoringInput = {
  completedTargets: number;
  totalTargets: number;
  pathEfficiencies: number[]; // 0..1
  torsoShiftRatios: number[]; // torso movement / shoulder width
  segmentTimesMs: number[];
};

export function scoreReach(input: ReachScoringInput) {
  const completion =
    input.totalTargets > 0
      ? (input.completedTargets / input.totalTargets) * 100
      : 0;

  const pathEfficiency = clamp(mean(input.pathEfficiencies)) * 100;

  // Prototype rule: an average torso shift at/above 20% of shoulder width
  // maps to 0 body-stability points. This is NOT a clinical threshold.
  const meanTorsoShiftRatio = mean(input.torsoShiftRatios);
  const bodyStability =
    (1 - clamp(meanTorsoShiftRatio / 0.2, 0, 1)) * 100;

  // Lower variation across target-completion times = higher consistency.
  const cv = coefficientOfVariation(input.segmentTimesMs);
  const consistency = (1 - clamp(cv / 0.5, 0, 1)) * 100;

  const reachScore =
    0.35 * completion +
    0.25 * pathEfficiency +
    0.2 * bodyStability +
    0.2 * consistency;

  return {
    completion: Math.round(completion),
    pathEfficiency: Math.round(pathEfficiency),
    bodyStability: Math.round(bodyStability),
    consistency: Math.round(consistency),
    reachScore: Math.round(reachScore),
  };
}
