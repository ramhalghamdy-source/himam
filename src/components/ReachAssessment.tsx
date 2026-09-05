import { useEffect, useRef, useState } from 'react';
import {
  DrawingUtils,
  PoseLandmarker,
  type HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { createVisionModels } from '../lib/mediapipe';
import {
  angleDegrees,
  distance,
  emaPoint,
  midpoint,
} from '../lib/math';
import { scoreReach } from '../lib/reachScoring';
import type {
  AssessmentStatus,
  Point2D,
  ReachMetrics,
  Side,
} from '../types/assessment';
import { MetricCard } from './MetricCard';

const TARGET_RADIUS = 0.075;
const HOLD_MS = 240;

const TARGETS: Point2D[] = [
  { x: 0.5, y: 0.75 },
  { x: 0.24, y: 0.42 },
  { x: 0.76, y: 0.42 },
  { x: 0.22, y: 0.65 },
  { x: 0.78, y: 0.65 },
];

const POSE_INDEX = {
  left: { shoulder: 11, elbow: 13, wrist: 15 },
  right: { shoulder: 12, elbow: 14, wrist: 16 },
  leftShoulder: 11,
  rightShoulder: 12,
};

const EMPTY_METRICS: ReachMetrics = {
  completion: 0,
  pathEfficiency: 0,
  bodyStability: 0,
  consistency: 0,
  reachScore: 0,
  elbowAngle: null,
  completedTargets: 0,
  totalTargets: TARGETS.length,
};

type Props = {
  onComplete?: (metrics: ReachMetrics) => void;
};

export function ReachAssessment({ onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseRef = useRef<PoseLandmarker | null>(null);
  const handRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);

  const [status, setStatus] = useState<AssessmentStatus>('idle');
  const statusRef = useRef<AssessmentStatus>('idle');
  const [side, setSide] = useState<Side>('right');
  const sideRef = useRef<Side>('right');
  const [message, setMessage] = useState('Start the camera to begin.');
  const [targetIndex, setTargetIndex] = useState(0);
  const targetIndexRef = useRef(0);
  const [metrics, setMetrics] = useState<ReachMetrics>(EMPTY_METRICS);

  const baselineTorsoRef = useRef<Point2D | null>(null);
  const baselineShoulderWidthRef = useRef<number | null>(null);
  const calibrationSamplesRef = useRef<{
    torso: Point2D[];
    shoulderWidth: number[];
  }>({ torso: [], shoulderWidth: [] });
  const calibrationUntilRef = useRef<number | null>(null);

  const smoothedWristRef = useRef<Point2D | null>(null);
  const smoothedLeftShoulderRef = useRef<Point2D | null>(null);
  const smoothedRightShoulderRef = useRef<Point2D | null>(null);

  const segmentStartPointRef = useRef<Point2D | null>(null);
  const segmentStartTimeRef = useRef<number | null>(null);
  const actualPathRef = useRef(0);
  const lastWristRef = useRef<Point2D | null>(null);
  const holdStartRef = useRef<number | null>(null);

  const pathEfficienciesRef = useRef<number[]>([]);
  const torsoShiftRatiosRef = useRef<number[]>([]);
  const segmentTimesRef = useRef<number[]>([]);

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
      poseRef.current?.close();
      handRef.current?.close();
    };
  }, []);

  async function startCamera() {
    try {
      updateStatus('loading-models');
      setMessage('Loading on-device vision models…');

      const models = await createVisionModels();
      poseRef.current = models.poseLandmarker;
      handRef.current = models.handLandmarker;

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
      setMessage('Camera ready. Keep your upper body visible, then calibrate.');
      predictLoop();
    } catch (error) {
      console.error(error);
      updateStatus('error');
      setMessage(
        'Could not start the camera or models. Use Chrome/Edge and allow camera access.',
      );
    }
  }

  function startCalibration() {
    calibrationSamplesRef.current = { torso: [], shoulderWidth: [] };
    calibrationUntilRef.current = performance.now() + 2500;
    updateStatus('calibrating');
    setMessage('Calibrating… stay comfortably still for 2.5 seconds.');
  }

  function finalizeCalibration() {
    const samples = calibrationSamplesRef.current;
    if (samples.torso.length < 8 || samples.shoulderWidth.length < 8) {
      calibrationUntilRef.current = performance.now() + 1500;
      setMessage('Hold still a little longer — making sure shoulders are visible.');
      return;
    }

    const avgTorso = samples.torso.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 },
    );
    avgTorso.x /= samples.torso.length;
    avgTorso.y /= samples.torso.length;

    baselineTorsoRef.current = avgTorso;
    baselineShoulderWidthRef.current =
      samples.shoulderWidth.reduce((a, b) => a + b, 0) /
      samples.shoulderWidth.length;

    calibrationUntilRef.current = null;
    updateStatus('ready');
    setMessage('Calibration complete. Press Start Reach Test.');
  }

  function startTest() {
    targetIndexRef.current = 0;
    setTargetIndex(0);
    setMetrics(EMPTY_METRICS);
    pathEfficienciesRef.current = [];
    torsoShiftRatiosRef.current = [];
    segmentTimesRef.current = [];
    segmentStartPointRef.current = smoothedWristRef.current;
    segmentStartTimeRef.current = performance.now();
    actualPathRef.current = 0;
    lastWristRef.current = smoothedWristRef.current;
    holdStartRef.current = null;
    updateStatus('running');
    setMessage('Reach the highlighted target and hold briefly.');
  }

  function finishTest(elbowAngle: number | null) {
    const scored = scoreReach({
      completedTargets: TARGETS.length,
      totalTargets: TARGETS.length,
      pathEfficiencies: pathEfficienciesRef.current,
      torsoShiftRatios: torsoShiftRatiosRef.current,
      segmentTimesMs: segmentTimesRef.current,
    });

    const finalMetrics: ReachMetrics = {
      ...scored,
      elbowAngle,
      completedTargets: TARGETS.length,
      totalTargets: TARGETS.length,
    };

    setMetrics(finalMetrics);
    updateStatus('complete');
    setMessage('Reach assessment complete.');
    onComplete?.(finalMetrics);
  }

  function onTargetHit(now: number, wrist: Point2D, elbowAngle: number | null) {
    const currentTarget = TARGETS[targetIndexRef.current];
    const startPoint = segmentStartPointRef.current ?? wrist;
    const straight = distance(startPoint, currentTarget);
    const actual = Math.max(actualPathRef.current, straight, 0.0001);
    pathEfficienciesRef.current.push(Math.min(straight / actual, 1));

    if (segmentStartTimeRef.current != null) {
      segmentTimesRef.current.push(now - segmentStartTimeRef.current);
    }

    const completed = targetIndexRef.current + 1;
    if (completed >= TARGETS.length) {
      finishTest(elbowAngle);
      return;
    }

    targetIndexRef.current = completed;
    setTargetIndex(completed);
    segmentStartPointRef.current = wrist;
    segmentStartTimeRef.current = now;
    actualPathRef.current = 0;
    lastWristRef.current = wrist;
    holdStartRef.current = null;
  }

  function drawTargets(ctx: CanvasRenderingContext2D, width: number, height: number) {
    TARGETS.forEach((target, index) => {
      const x = target.x * width;
      const y = target.y * height;
      const radius = TARGET_RADIUS * Math.min(width, height);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.lineWidth = index === targetIndexRef.current ? 7 : 3;
      ctx.strokeStyle = index === targetIndexRef.current ? '#19a987' : 'rgba(255,255,255,.45)';
      ctx.fillStyle =
        index < targetIndexRef.current
          ? 'rgba(25,169,135,.28)'
          : 'rgba(255,255,255,.08)';
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 18px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1), x, y);
      ctx.restore();
    });
  }

  function asPoint(lm: NormalizedLandmark): Point2D {
    return { x: lm.x, y: lm.y };
  }

  function processPose(landmarks: NormalizedLandmark[], now: number) {
    const leftShoulderRaw = asPoint(landmarks[POSE_INDEX.leftShoulder]);
    const rightShoulderRaw = asPoint(landmarks[POSE_INDEX.rightShoulder]);
    const activeSideIndices = POSE_INDEX[sideRef.current];
    const wristRaw = asPoint(landmarks[activeSideIndices.wrist]);
    const elbow = asPoint(landmarks[activeSideIndices.elbow]);
    const shoulder = asPoint(landmarks[activeSideIndices.shoulder]);

    const leftShoulder = emaPoint(
      smoothedLeftShoulderRef.current,
      leftShoulderRaw,
    );
    const rightShoulder = emaPoint(
      smoothedRightShoulderRef.current,
      rightShoulderRaw,
    );
    const wrist = emaPoint(smoothedWristRef.current, wristRaw);

    smoothedLeftShoulderRef.current = leftShoulder;
    smoothedRightShoulderRef.current = rightShoulder;
    smoothedWristRef.current = wrist;

    const shoulderWidth = distance(leftShoulder, rightShoulder);
    const torso = midpoint(leftShoulder, rightShoulder);
    const elbowAngle = Math.round(angleDegrees(shoulder, elbow, wrist));

    if (statusRef.current === 'calibrating') {
      calibrationSamplesRef.current.torso.push(torso);
      if (shoulderWidth > 0.02) {
        calibrationSamplesRef.current.shoulderWidth.push(shoulderWidth);
      }
      if (calibrationUntilRef.current && now >= calibrationUntilRef.current) {
        finalizeCalibration();
      }
    }

    if (statusRef.current !== 'running') {
      setMetrics((prev) => ({ ...prev, elbowAngle }));
      return;
    }

    if (lastWristRef.current) {
      actualPathRef.current += distance(lastWristRef.current, wrist);
    }
    lastWristRef.current = wrist;

    const baselineTorso = baselineTorsoRef.current;
    const baselineShoulderWidth = baselineShoulderWidthRef.current;
    if (baselineTorso && baselineShoulderWidth && baselineShoulderWidth > 0) {
      const shiftRatio = distance(torso, baselineTorso) / baselineShoulderWidth;
      torsoShiftRatiosRef.current.push(shiftRatio);
    }

    const currentTarget = TARGETS[targetIndexRef.current];
    const inTarget = distance(wrist, currentTarget) <= TARGET_RADIUS;

    if (inTarget) {
      if (holdStartRef.current == null) holdStartRef.current = now;
      if (now - holdStartRef.current >= HOLD_MS) {
        onTargetHit(now, wrist, elbowAngle);
      }
    } else {
      holdStartRef.current = null;
    }

    const partial = scoreReach({
      completedTargets: targetIndexRef.current,
      totalTargets: TARGETS.length,
      pathEfficiencies: pathEfficienciesRef.current,
      torsoShiftRatios: torsoShiftRatiosRef.current,
      segmentTimesMs: segmentTimesRef.current,
    });

    setMetrics({
      ...partial,
      elbowAngle,
      completedTargets: targetIndexRef.current,
      totalTargets: TARGETS.length,
    });
  }

  function predictLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const pose = poseRef.current;
    const hand = handRef.current;

    if (!video || !canvas || !pose || !hand) {
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

      const poseResult = pose.detectForVideo(video, now);
      const handResult = hand.detectForVideo(video, now);
      const drawing = new DrawingUtils(ctx);

      if (poseResult.landmarks?.length) {
        const person = poseResult.landmarks[0];
        drawing.drawConnectors(person, PoseLandmarker.POSE_CONNECTIONS, {
          color: '#8de1cf',
          lineWidth: 3,
        });
        drawing.drawLandmarks(person, {
          color: '#ffffff',
          fillColor: '#19a987',
          radius: 4,
        });
        processPose(person, now);
      }

      if (handResult.landmarks?.length) {
        handResult.landmarks.forEach((handLandmarks) => {
          drawing.drawLandmarks(handLandmarks, {
            color: '#f7c76d',
            fillColor: '#f7c76d',
            radius: 2.7,
          });
        });
      }

      if (
        statusRef.current === 'running' ||
        statusRef.current === 'ready' ||
        statusRef.current === 'complete'
      ) {
        drawTargets(ctx, width, height);
      }
    }

    rafRef.current = requestAnimationFrame(predictLoop);
  }

  return (
    <section className="assessment-shell">
      <div className="assessment-header">
        <div>
          <div className="eyebrow">Assessment 01 · Reach & Target</div>
          <h2>Functional reach, measured from an ordinary camera</h2>
          <p>{message}</p>
        </div>
        <div className={`status-pill status-${status}`}>{status.replace('-', ' ')}</div>
      </div>

      <div className="assessment-grid">
        <div className="camera-card">
          <div className="video-stage">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {status === 'idle' && (
              <div className="camera-placeholder">Camera preview will appear here.</div>
            )}
          </div>

          <div className="controls-row">
            <div className="side-toggle" aria-label="Tested side">
              <button
                className={side === 'left' ? 'active' : ''}
                onClick={() => updateSide('left')}
                disabled={status === 'running' || status === 'calibrating'}
              >
                Left
              </button>
              <button
                className={side === 'right' ? 'active' : ''}
                onClick={() => updateSide('right')}
                disabled={status === 'running' || status === 'calibrating'}
              >
                Right
              </button>
            </div>

            {status === 'idle' || status === 'error' ? (
              <button className="primary-btn" onClick={startCamera}>
                Start camera
              </button>
            ) : status === 'camera-ready' ? (
              <button className="primary-btn" onClick={startCalibration}>
                Calibrate
              </button>
            ) : status === 'ready' || status === 'complete' ? (
              <button className="primary-btn" onClick={startTest}>
                {status === 'complete' ? 'Run again' : 'Start Reach Test'}
              </button>
            ) : (
              <button className="primary-btn" disabled>
                {status === 'calibrating' ? 'Calibrating…' : 'Test in progress…'}
              </button>
            )}
          </div>
        </div>

        <aside className="results-panel">
          <div className="progress-line">
            <span>Targets</span>
            <strong>
              {Math.min(targetIndex + (status === 'complete' ? 1 : 0), TARGETS.length)} / {TARGETS.length}
            </strong>
          </div>
          <div className="mini-progress">
            <div
              style={{
                width: `${
                  (Math.min(
                    targetIndex + (status === 'complete' ? 1 : 0),
                    TARGETS.length,
                  ) /
                    TARGETS.length) *
                  100
                }%`,
              }}
            />
          </div>

          <div className="metric-grid">
            <MetricCard label="Reach score" value={metrics.reachScore} hint="0–100 task score" />
            <MetricCard
              label="Elbow angle"
              value={metrics.elbowAngle == null ? '—' : `${metrics.elbowAngle}°`}
              hint="live estimate"
            />
            <MetricCard label="Completion" value={`${metrics.completion}%`} />
            <MetricCard label="Path efficiency" value={`${metrics.pathEfficiency}%`} />
            <MetricCard label="Body stability" value={`${metrics.bodyStability}%`} />
            <MetricCard label="Consistency" value={`${metrics.consistency}%`} />
          </div>

          <div className="safety-note">
            <strong>Prototype interpretation</strong>
            <p>
              HIMAM scores performance inside this task. They are not a diagnosis,
              disability grade, or medical fitness-for-work decision.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
