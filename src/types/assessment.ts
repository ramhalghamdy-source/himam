export type Side = 'left' | 'right';

export type Point2D = {
  x: number;
  y: number;
};

export type ReachMetrics = {
  completion: number;
  pathEfficiency: number;
  bodyStability: number;
  consistency: number;
  reachScore: number;
  elbowAngle: number | null;
  completedTargets: number;
  totalTargets: number;
};

export type HandMetrics = {
  transferSuccess: number;
  endpointPrecision: number;
  pinchControl: number;
  pathEfficiency: number;
  handControlScore: number;
  completedTransfers: number;
  totalTransfers: number;
  pinchGap: number | null;
  pinchThreshold: number | null;
};


export type DigitalMetrics = {
  targetAccuracy: number;
  dragSuccess: number;
  typingAccuracy: number;
  pace: number;
  digitalControlScore: number;
  elapsedSeconds: number;
  correctTargets: number;
  totalTargets: number;
  correctDrops: number;
  totalDrops: number;
};

export type AssessmentStatus =
  | 'idle'
  | 'loading-models'
  | 'camera-ready'
  | 'calibrating'
  | 'calibrating-open'
  | 'calibrating-pinch'
  | 'ready'
  | 'running'
  | 'complete'
  | 'error';
