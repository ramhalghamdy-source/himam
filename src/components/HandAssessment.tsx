import { useEffect, useRef, useState } from 'react';
import {
  DrawingUtils,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { createVisionModels } from '../lib/mediapipe';
import { distance, emaPoint, midpoint } from '../lib/math';
import { scoreHandControl } from '../lib/handScoring';
import type {
  AssessmentStatus,
  HandMetrics,
  Point2D,
  Side,
} from '../types/assessment';
import { MetricCard } from './MetricCard';

const TOTAL_TRANSFERS = 4;
const PICKUP_RADIUS = 0.07;
const TARGET_RADIUS = 0.095;
const CALIBRATION_MS = 1500;

const TRANSFERS: Array<{ object: Point2D; target: Point2D }> = [
  { object: { x: 0.28, y: 0.68 }, target: { x: 0.72, y: 0.34 } },
  { object: { x: 0.72, y: 0.68 }, target: { x: 0.30, y: 0.34 } },
  { object: { x: 0.32, y: 0.42 }, target: { x: 0.72, y: 0.66 } },
  { object: { x: 0.68, y: 0.42 }, target: { x: 0.28, y: 0.66 } },
];

const HAND_INDEX = {
  wrist: 0,
  thumbTip: 4,
  indexMcp: 5,
  indexTip: 8,
  pinkyMcp: 17,
};

const EMPTY_METRICS: HandMetrics = {
  transferSuccess: 0,
  endpointPrecision: 0,
  pinchControl: 0,
  pathEfficiency: 0,
  handControlScore: 0,
  completedTransfers: 0,
  totalTransfers: TOTAL_TRANSFERS,
  pinchGap: null,
  pinchThreshold: null,
};

type Props = {
  onComplete?: (metrics: HandMetrics) => void;
};

export function HandAssessment({ onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);

  const [status, setStatus] = useState<AssessmentStatus>('idle');
  const statusRef = useRef<AssessmentStatus>('idle');
  const [side, setSide] = useState<Side>('right');
  const sideRef = useRef<Side>('right');
  const [message, setMessage] = useState('Start the camera to begin.');
  const [transferIndex, setTransferIndex] = useState(0);
  const transferIndexRef = useRef(0);
  const [metrics, setMetrics] = useState<HandMetrics>(EMPTY_METRICS);

  const openSamplesRef = useRef<number[]>([]);
  const pinchSamplesRef = useRef<number[]>([]);
  const calibrationUntilRef = useRef<number | null>(null);
  const openGapRef = useRef<number | null>(null);
  const pinchGapRef = useRef<number | null>(null);
  const pinchThresholdRef = useRef<number | null>(null);

  const smoothedPinchPointRef = useRef<Point2D | null>(null);
  const isDraggingRef = useRef(false);
  const objectPositionRef = useRef<Point2D>(TRANSFERS[0].object);
  const lastDragPointRef = useRef<Point2D | null>(null);
  const actualPathRef = useRef(0);
  const pinchQualitySamplesRef = useRef<number[]>([]);
  const activeTrialQualitiesRef = useRef<number[]>([]);
  const endpointPrecisionsRef = useRef<number[]>([]);
  const pathEfficienciesRef = useRef<number[]>([]);
  const successfulTransfersRef = useRef(0);

  function updateStatus(next: AssessmentStatus) {
    statusRef.current = next;
    setStatus(next);
  }

  function updateSide(next: Side) {
    sideRef.current = next;
    setSide(next);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      handRef.current?.close();
    };
  }, []);

  async function startCamera() {
    try {
      updateStatus('loading-models');
      setMessage('Loading on-device hand tracking…');

      const models = await createVisionModels();
      handRef.current = models.handLandmarker;
      // Test 02 does not need pose inference. Release it immediately.
      models.poseLandmarker.close();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      updateStatus('camera-ready');
      setMessage('Camera ready. Keep one hand clearly visible, then calibrate.');
      predictLoop();
    } catch (error) {
      console.error(error);
      updateStatus('error');
      setMessage(
        'Could not start hand tracking. Use Chrome/Edge and allow camera access.',
      );
    }
  }

  function startOpenCalibration() {
    openSamplesRef.current = [];
    calibrationUntilRef.current = performance.now() + CALIBRATION_MS;
    updateStatus('calibrating-open');
    setMessage('Calibration 1/2 — hold the tested hand comfortably OPEN.');
  }

  function startPinchCalibration() {
    pinchSamplesRef.current = [];
    calibrationUntilRef.current = performance.now() + CALIBRATION_MS;
    updateStatus('calibrating-pinch');
    setMessage('Calibration 2/2 — gently PINCH thumb and index finger together.');
  }

  function median(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function finalizeOpenCalibration() {
    if (openSamplesRef.current.length < 8) {
      calibrationUntilRef.current = performance.now() + 900;
      setMessage('Keep the open hand visible a little longer.');
      return;
    }
    openGapRef.current = median(openSamplesRef.current);
    startPinchCalibration();
  }

  function finalizePinchCalibration() {
    if (pinchSamplesRef.current.length < 8) {
      calibrationUntilRef.current = performance.now() + 900;
      setMessage('Keep the pinch visible a little longer.');
      return;
    }

    const openGap = openGapRef.current ?? 0;
    const pinchGap = median(pinchSamplesRef.current);
    if (openGap <= pinchGap * 1.12) {
      updateStatus('camera-ready');
      calibrationUntilRef.current = null;
      setMessage('Calibration was too similar. Try again with a wider open hand.');
      return;
    }

    pinchGapRef.current = pinchGap;
    pinchThresholdRef.current = (openGap + pinchGap) / 2;
    calibrationUntilRef.current = null;
    updateStatus('ready');
    setMetrics((prev) => ({
      ...prev,
      pinchThreshold: pinchThresholdRef.current,
    }));
    setMessage('Calibration complete. Press Start Hand Test.');
  }

  function resetTrial(index: number) {
    objectPositionRef.current = TRANSFERS[index].object;
    isDraggingRef.current = false;
    lastDragPointRef.current = null;
    actualPathRef.current = 0;
    activeTrialQualitiesRef.current = [];
  }

  function startTest() {
    transferIndexRef.current = 0;
    setTransferIndex(0);
    setMetrics({
      ...EMPTY_METRICS,
      pinchThreshold: pinchThresholdRef.current,
    });
    endpointPrecisionsRef.current = [];
    pathEfficienciesRef.current = [];
    pinchQualitySamplesRef.current = [];
    successfulTransfersRef.current = 0;
    resetTrial(0);
    updateStatus('running');
    setMessage('Pinch the gold object, drag it into the target, then release.');
  }

  function finishTest(currentGap: number | null) {
    const scored = scoreHandControl({
      successfulTransfers: successfulTransfersRef.current,
      totalTransfers: TOTAL_TRANSFERS,
      endpointPrecisions: endpointPrecisionsRef.current,
      pinchQualities: pinchQualitySamplesRef.current,
      pathEfficiencies: pathEfficienciesRef.current,
    });

    const finalMetrics: HandMetrics = {
      ...scored,
      completedTransfers: TOTAL_TRANSFERS,
      totalTransfers: TOTAL_TRANSFERS,
      pinchGap: currentGap,
      pinchThreshold: pinchThresholdRef.current,
    };

    setMetrics(finalMetrics);
    updateStatus('complete');
    setMessage('Hand control assessment complete.');
    onComplete?.(finalMetrics);
  }

  function finishTrial(releasePoint: Point2D, currentGap: number | null) {
    const index = transferIndexRef.current;
    const spec = TRANSFERS[index];
    const endpointError = distance(releasePoint, spec.target);
    const precision = Math.max(0, 1 - endpointError / (TARGET_RADIUS * 1.35));
    endpointPrecisionsRef.current.push(precision);

    const straight = distance(spec.object, spec.target);
    const actual = Math.max(actualPathRef.current, straight, 0.0001);
    pathEfficienciesRef.current.push(Math.min(straight / actual, 1));

    if (endpointError <= TARGET_RADIUS) {
      successfulTransfersRef.current += 1;
    }

    if (activeTrialQualitiesRef.current.length) {
      pinchQualitySamplesRef.current.push(...activeTrialQualitiesRef.current);
    }

    const completed = index + 1;
    if (completed >= TOTAL_TRANSFERS) {
      finishTest(currentGap);
      return;
    }

    transferIndexRef.current = completed;
    setTransferIndex(completed);
    resetTrial(completed);
    setMessage('Nice. Pinch the next object and place it in its target.');
  }

  function asPoint(lm: NormalizedLandmark): Point2D {
    return { x: lm.x, y: lm.y };
  }

  function normalizedPinchGap(hand: NormalizedLandmark[]) {
    const thumb = asPoint(hand[HAND_INDEX.thumbTip]);
    const index = asPoint(hand[HAND_INDEX.indexTip]);
    const indexMcp = asPoint(hand[HAND_INDEX.indexMcp]);
    const pinkyMcp = asPoint(hand[HAND_INDEX.pinkyMcp]);
    const palmWidth = Math.max(distance(indexMcp, pinkyMcp), 0.015);
    return distance(thumb, index) / palmWidth;
  }

  function chooseTestedHand(
    landmarks: NormalizedLandmark[][],
    handednesses: unknown,
  ): NormalizedLandmark[] | null {
    if (!landmarks.length) return null;

    const groups = handednesses as
      | Array<Array<{ categoryName?: string; displayName?: string }>>
      | undefined;
    if (!groups?.length) return landmarks[0];

    const wanted = sideRef.current.toLowerCase();
    const matchIndex = groups.findIndex((group) => {
      const raw = group?.[0]?.categoryName ?? group?.[0]?.displayName ?? '';
      return raw.toLowerCase() === wanted;
    });

    return landmarks[matchIndex >= 0 ? matchIndex : 0] ?? landmarks[0];
  }

  function processHand(hand: NormalizedLandmark[], now: number) {
    const thumb = asPoint(hand[HAND_INDEX.thumbTip]);
    const index = asPoint(hand[HAND_INDEX.indexTip]);
    const rawPinchPoint = midpoint(thumb, index);
    const pinchPoint = emaPoint(smoothedPinchPointRef.current, rawPinchPoint, 0.5);
    smoothedPinchPointRef.current = pinchPoint;

    const gap = normalizedPinchGap(hand);

    if (statusRef.current === 'calibrating-open') {
      openSamplesRef.current.push(gap);
      if (calibrationUntilRef.current && now >= calibrationUntilRef.current) {
        finalizeOpenCalibration();
      }
    } else if (statusRef.current === 'calibrating-pinch') {
      pinchSamplesRef.current.push(gap);
      if (calibrationUntilRef.current && now >= calibrationUntilRef.current) {
        finalizePinchCalibration();
      }
    }

    setMetrics((prev) => ({ ...prev, pinchGap: gap }));

    if (statusRef.current !== 'running') return;

    const threshold = pinchThresholdRef.current;
    const calibratedPinch = pinchGapRef.current;
    if (!threshold || calibratedPinch == null) return;

    const grabThreshold = threshold;
    const releaseThreshold = threshold * 1.12;
    const trial = TRANSFERS[transferIndexRef.current];

    if (!isDraggingRef.current) {
      const nearObject = distance(pinchPoint, objectPositionRef.current) <= PICKUP_RADIUS;
      if (gap <= grabThreshold && nearObject) {
        isDraggingRef.current = true;
        lastDragPointRef.current = pinchPoint;
        actualPathRef.current = 0;
        activeTrialQualitiesRef.current = [];
        setMessage('Object grabbed — move it to the outlined target and release.');
      }
    } else {
      if (lastDragPointRef.current) {
        actualPathRef.current += distance(lastDragPointRef.current, pinchPoint);
      }
      lastDragPointRef.current = pinchPoint;
      objectPositionRef.current = pinchPoint;

      const qualityDenominator = Math.max(threshold - calibratedPinch, 0.04);
      const pinchQuality = Math.max(
        0,
        Math.min(1, 1 - Math.abs(gap - calibratedPinch) / qualityDenominator),
      );
      activeTrialQualitiesRef.current.push(pinchQuality);

      if (gap >= releaseThreshold) {
        isDraggingRef.current = false;
        finishTrial(pinchPoint, gap);
      }
    }

    const partial = scoreHandControl({
      successfulTransfers: successfulTransfersRef.current,
      totalTransfers: TOTAL_TRANSFERS,
      endpointPrecisions: endpointPrecisionsRef.current,
      pinchQualities: pinchQualitySamplesRef.current.concat(
        activeTrialQualitiesRef.current,
      ),
      pathEfficiencies: pathEfficienciesRef.current,
    });

    setMetrics((prev) => ({
      ...partial,
      completedTransfers: transferIndexRef.current,
      totalTransfers: TOTAL_TRANSFERS,
      pinchGap: gap,
      pinchThreshold: prev.pinchThreshold ?? pinchThresholdRef.current,
    }));

    // Keep TS aware that the trial target is intentionally used by the draw layer.
    void trial;
  }

  function drawTask(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (!['ready', 'running', 'complete'].includes(statusRef.current)) return;

    const index = Math.min(transferIndexRef.current, TOTAL_TRANSFERS - 1);
    const spec = TRANSFERS[index];
    const object = objectPositionRef.current;
    const scale = Math.min(width, height);

    ctx.save();

    // Target zone
    ctx.beginPath();
    ctx.arc(spec.target.x * width, spec.target.y * height, TARGET_RADIUS * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(25,169,135,.14)';
    ctx.strokeStyle = '#43d8b6';
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 9]);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Object
    ctx.beginPath();
    ctx.arc(object.x * width, object.y * height, PICKUP_RADIUS * scale * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = '#f7c76d';
    ctx.shadowColor = 'rgba(247,199,109,.55)';
    ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff4cc';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 17px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(
      isDraggingRef.current ? 'MOVE' : 'PINCH',
      object.x * width,
      object.y * height + 6,
    );

    ctx.restore();
  }

  function predictLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const handLandmarker = handRef.current;

    if (!video || !canvas || !handLandmarker) {
      rafRef.current = requestAnimationFrame(predictLoop);
      return;
    }

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const now = performance.now();
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, width, height);

      const result = handLandmarker.detectForVideo(video, now);
      const drawing = new DrawingUtils(ctx);

      if (result.landmarks?.length) {
        result.landmarks.forEach((hand) => {
          drawing.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, {
            color: 'rgba(141,225,207,.85)',
            lineWidth: 3,
          });
          drawing.drawLandmarks(hand, {
            color: '#f7c76d',
            fillColor: '#f7c76d',
            radius: 3.2,
          });
        });

        const tested = chooseTestedHand(result.landmarks, result.handednesses);
        if (tested) processHand(tested, now);
      }

      drawTask(ctx, width, height);
    }

    rafRef.current = requestAnimationFrame(predictLoop);
  }

  const completedForUi =
    status === 'complete'
      ? TOTAL_TRANSFERS
      : Math.min(transferIndex, TOTAL_TRANSFERS);

  return (
    <section className="assessment-shell">
      <div className="assessment-header">
        <div>
          <div className="eyebrow">Assessment 02 · Pinch & Transfer</div>
          <h2>Hand precision, grip control, and transfer accuracy</h2>
          <p>{message}</p>
        </div>
        <div className={`status-pill status-${status}`}>
          {status.replaceAll('-', ' ')}
        </div>
      </div>

      <div className="assessment-grid">
        <div className="camera-card">
          <div className="video-stage">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {status === 'idle' && (
              <div className="camera-placeholder">Hand camera preview will appear here.</div>
            )}
            {status === 'calibrating-open' && (
              <div className="gesture-coach"><strong>OPEN</strong><span>Keep fingers comfortably apart</span></div>
            )}
            {status === 'calibrating-pinch' && (
              <div className="gesture-coach"><strong>PINCH</strong><span>Thumb + index finger together</span></div>
            )}
          </div>

          <div className="controls-row">
            <div className="side-toggle" aria-label="Tested hand">
              <button
                className={side === 'left' ? 'active' : ''}
                onClick={() => updateSide('left')}
                disabled={status === 'running' || status.startsWith('calibrating')}
              >
                Left hand
              </button>
              <button
                className={side === 'right' ? 'active' : ''}
                onClick={() => updateSide('right')}
                disabled={status === 'running' || status.startsWith('calibrating')}
              >
                Right hand
              </button>
            </div>

            {status === 'idle' || status === 'error' ? (
              <button className="primary-btn" onClick={startCamera}>Start camera</button>
            ) : status === 'camera-ready' ? (
              <button className="primary-btn" onClick={startOpenCalibration}>Calibrate pinch</button>
            ) : status === 'ready' || status === 'complete' ? (
              <button className="primary-btn" onClick={startTest}>
                {status === 'complete' ? 'Run again' : 'Start Hand Test'}
              </button>
            ) : (
              <button className="primary-btn" disabled>
                {status.startsWith('calibrating') ? 'Calibrating…' : status === 'running' ? 'Test in progress…' : 'Loading…'}
              </button>
            )}
          </div>
        </div>

        <aside className="results-panel">
          <div className="progress-line">
            <span>Transfers</span>
            <strong>{completedForUi} / {TOTAL_TRANSFERS}</strong>
          </div>
          <div className="mini-progress">
            <div style={{ width: `${(completedForUi / TOTAL_TRANSFERS) * 100}%` }} />
          </div>

          <div className="metric-grid">
            <MetricCard label="Hand control" value={metrics.handControlScore} hint="0–100 task score" />
            <MetricCard
              label="Live pinch gap"
              value={metrics.pinchGap == null ? '—' : metrics.pinchGap.toFixed(2)}
              hint="normalized to palm width"
            />
            <MetricCard label="Transfer success" value={`${metrics.transferSuccess}%`} />
            <MetricCard label="Endpoint precision" value={`${metrics.endpointPrecision}%`} />
            <MetricCard label="Pinch control" value={`${metrics.pinchControl}%`} />
            <MetricCard label="Path efficiency" value={`${metrics.pathEfficiency}%`} />
          </div>

          <div className="calibration-strip">
            <span>Personal pinch threshold</span>
            <strong>
              {metrics.pinchThreshold == null ? 'Not calibrated' : metrics.pinchThreshold.toFixed(2)}
            </strong>
          </div>

          <div className="safety-note">
            <strong>Prototype interpretation</strong>
            <p>
              The score describes performance in this simulated transfer task. It is not
              a clinical hand-function diagnosis or a fitness-for-work decision.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
