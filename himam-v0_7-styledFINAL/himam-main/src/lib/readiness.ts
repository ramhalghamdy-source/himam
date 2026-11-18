export type FunctionalProfile = {
  reach: number;
  hand: number;
  coordination: number;
  digital: number;
};

export type ReadinessLevel =
  | 'Strong task readiness'
  | 'Near-ready'
  | 'Training recommended'
  | 'Further practice needed';

export type WorkReadinessItem = {
  id: 'office' | 'documents' | 'sorting' | 'assembly';
  label: string;
  score: number;
  level: ReadinessLevel;
  weights: FunctionalProfile;
};

const MATRIX: Array<Omit<WorkReadinessItem, 'score' | 'level'>> = [
  {
    id: 'office',
    label: 'Office Computer Tasks',
    weights: { reach: 0.1, hand: 0.15, coordination: 0.25, digital: 0.5 },
  },
  {
    id: 'documents',
    label: 'Document Handling',
    weights: { reach: 0.3, hand: 0.3, coordination: 0.3, digital: 0.1 },
  },
  {
    id: 'sorting',
    label: 'Sorting & Packaging',
    weights: { reach: 0.35, hand: 0.25, coordination: 0.35, digital: 0.05 },
  },
  {
    id: 'assembly',
    label: 'Fine Assembly',
    weights: { reach: 0.1, hand: 0.45, coordination: 0.4, digital: 0.05 },
  },
];

export function readinessLevel(score: number): ReadinessLevel {
  if (score >= 80) return 'Strong task readiness';
  if (score >= 65) return 'Near-ready';
  if (score >= 45) return 'Training recommended';
  return 'Further practice needed';
}

export function calculateWorkReadiness(profile: FunctionalProfile): WorkReadinessItem[] {
  return MATRIX.map((item) => {
    const score = Math.round(
      profile.reach * item.weights.reach +
        profile.hand * item.weights.hand +
        profile.coordination * item.weights.coordination +
        profile.digital * item.weights.digital,
    );

    return {
      ...item,
      score,
      level: readinessLevel(score),
    };
  });
}

export function trainingRecommendation(profile: FunctionalProfile) {
  const domains = [
    { key: 'reach', label: 'Reach Control', score: profile.reach, module: 'Reach & Stability · Level 1' },
    { key: 'hand', label: 'Hand Precision', score: profile.hand, module: 'Precision Transfer · Level 1' },
    { key: 'coordination', label: 'Coordination', score: profile.coordination, module: 'Guided Coordination · Level 1' },
    { key: 'digital', label: 'Digital Control', score: profile.digital, module: 'Digital Targeting · Level 1' },
  ] as const;

  return [...domains].sort((a, b) => a.score - b.score)[0];
}
