function clamp100(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type HandScoreInput = {
  successfulTransfers: number;
  totalTransfers: number;
  endpointPrecisions: number[];
  pinchQualities: number[];
  pathEfficiencies: number[];
};

export function scoreHandControl(input: HandScoreInput) {
  const transferSuccess = clamp100(
    input.totalTransfers > 0
      ? (input.successfulTransfers / input.totalTransfers) * 100
      : 0,
  );
  const endpointPrecision = clamp100(average(input.endpointPrecisions) * 100);
  const pinchControl = clamp100(average(input.pinchQualities) * 100);
  const pathEfficiency = clamp100(average(input.pathEfficiencies) * 100);

  const handControlScore = clamp100(
    0.35 * transferSuccess +
      0.25 * endpointPrecision +
      0.2 * pinchControl +
      0.2 * pathEfficiency,
  );

  return {
    transferSuccess,
    endpointPrecision,
    pinchControl,
    pathEfficiency,
    handControlScore,
  };
}
