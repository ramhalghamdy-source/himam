export type TrainingLevel = 1 | 2 | 3 | 4;

export type TrainingTrial = {
  accuracy: number; // 0..1
  pathEfficiency: number; // 0..1
  pace: number; // 0..1
  success: boolean;
  elapsedSeconds: number;
};

export type TrainingLevelConfig = {
  level: TrainingLevel;
  label: string;
  targetRadius: number;
  travel: number;
  referenceSeconds: number;
};

export type TrainingAdaptation = {
  level: TrainingLevel;
  highStreak: number;
  challengeBoost: number;
  action: 'level-up' | 'level-down' | 'challenge-up' | 'hold';
  message: string;
};

export type TrainingSessionResult = {
  module: string;
  focus: string;
  startingLevel: TrainingLevel;
  finalLevel: TrainingLevel;
  roundScores: number[];
  bestScore: number;
  averageScore: number;
  completedRounds: number;
  adaptations: string[];
};

const BASE_LEVELS: Record<TrainingLevel, TrainingLevelConfig> = {
  1: { level: 1, label: 'Foundation', targetRadius: 0.135, travel: 0.34, referenceSeconds: 8.0 },
  2: { level: 2, label: 'Controlled', targetRadius: 0.108, travel: 0.42, referenceSeconds: 7.2 },
  3: { level: 3, label: 'Precision', targetRadius: 0.086, travel: 0.50, referenceSeconds: 6.5 },
  4: { level: 4, label: 'Work-like', targetRadius: 0.069, travel: 0.57, referenceSeconds: 5.8 },
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clamp100(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function startingLevelFromDomainScore(score: number): TrainingLevel {
  if (score >= 90) return 4;
  if (score >= 75) return 3;
  if (score >= 60) return 2;
  return 1;
}

export function trainingLevelConfig(
  level: TrainingLevel,
  challengeBoost = 0,
): TrainingLevelConfig {
  const base = BASE_LEVELS[level];
  const boost = Math.max(0, Math.min(0.14, challengeBoost));
  return {
    ...base,
    // A small in-level challenge increase: slightly smaller target + longer reach.
    targetRadius: base.targetRadius * (1 - boost * 0.55),
    travel: Math.min(0.64, base.travel + boost),
    referenceSeconds: Math.max(4.8, base.referenceSeconds * (1 - boost * 0.18)),
  };
}

export function scoreTrainingRound(trials: TrainingTrial[]) {
  if (!trials.length) {
    return { accuracy: 0, pathEfficiency: 0, pace: 0, success: 0, score: 0 };
  }

  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  const accuracy = clamp01(average(trials.map((trial) => trial.accuracy)));
  const pathEfficiency = clamp01(average(trials.map((trial) => trial.pathEfficiency)));
  const pace = clamp01(average(trials.map((trial) => trial.pace)));
  const success = clamp01(average(trials.map((trial) => Number(trial.success))));

  // Accuracy dominates; speed is intentionally a small part of the score.
  const score = clamp100(
    100 * (0.45 * accuracy + 0.30 * pathEfficiency + 0.15 * pace + 0.10 * success),
  );

  return {
    accuracy: clamp100(accuracy * 100),
    pathEfficiency: clamp100(pathEfficiency * 100),
    pace: clamp100(pace * 100),
    success: clamp100(success * 100),
    score,
  };
}

export function adaptTrainingDifficulty(args: {
  level: TrainingLevel;
  roundScore: number;
  highStreak: number;
  challengeBoost: number;
}): TrainingAdaptation {
  const { roundScore } = args;
  let { level, highStreak, challengeBoost } = args;

  if (roundScore >= 85) {
    highStreak += 1;
    if (highStreak >= 2 && level < 4) {
      level = (level + 1) as TrainingLevel;
      return {
        level,
        highStreak: 0,
        challengeBoost: 0,
        action: 'level-up',
        message: `Two strong rounds ≥85: advanced to Level ${level}. Target size decreases and travel demand increases.`,
      };
    }

    challengeBoost = Math.min(0.14, challengeBoost + 0.04);
    return {
      level,
      highStreak,
      challengeBoost,
      action: 'challenge-up',
      message: 'Strong round: same level, with a slightly smaller target and longer transfer next round.',
    };
  }

  highStreak = 0;

  if (roundScore >= 70) {
    challengeBoost = Math.min(0.14, challengeBoost + 0.05);
    return {
      level,
      highStreak,
      challengeBoost,
      action: 'challenge-up',
      message: 'Stable performance: level held while the next round becomes slightly more demanding.',
    };
  }

  if (roundScore >= 50) {
    challengeBoost = Math.max(0, challengeBoost - 0.02);
    return {
      level,
      highStreak,
      challengeBoost,
      action: 'hold',
      message: 'Practice zone: difficulty held to reinforce control before adding more demand.',
    };
  }

  if (level > 1) {
    level = (level - 1) as TrainingLevel;
    return {
      level,
      highStreak,
      challengeBoost: 0,
      action: 'level-down',
      message: `Performance dropped below 50: moved to Level ${level} to rebuild successful repetitions.`,
    };
  }

  return {
    level,
    highStreak,
    challengeBoost: 0,
    action: 'hold',
    message: 'Foundation level held. The goal is clean, successful repetitions before increasing difficulty.',
  };
}
