import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  adaptTrainingDifficulty,
  scoreTrainingRound,
  startingLevelFromDomainScore,
  trainingLevelConfig,
  type TrainingAdaptation,
  type TrainingLevel,
  type TrainingSessionResult,
  type TrainingTrial,
} from '../lib/adaptiveTraining';
import type { Point2D } from '../types/assessment';
import { useI18n, type Msg } from '../i18n';

const ROUNDS = 3;
const TRIALS_PER_ROUND = 3;

const PATTERNS: Array<{ object: Point2D; direction: Point2D }> = [
  { object: { x: 0.23, y: 0.70 }, direction: { x: 0.78, y: 0.30 } },
  { object: { x: 0.73, y: 0.68 }, direction: { x: 0.27, y: 0.31 } },
  { object: { x: 0.25, y: 0.35 }, direction: { x: 0.76, y: 0.67 } },
  { object: { x: 0.72, y: 0.37 }, direction: { x: 0.28, y: 0.72 } },
  { object: { x: 0.20, y: 0.54 }, direction: { x: 0.80, y: 0.52 } },
  { object: { x: 0.50, y: 0.73 }, direction: { x: 0.50, y: 0.24 } },
];

function clamp(value: number, min = 0.06, max = 0.94) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point2D, b: Point2D) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function makeTrialSpec(level: TrainingLevel, boost: number, roundIndex: number, trialIndex: number) {
  const config = trainingLevelConfig(level, boost);
  const pattern = PATTERNS[(roundIndex * TRIALS_PER_ROUND + trialIndex) % PATTERNS.length];
  const dx = pattern.direction.x - pattern.object.x;
  const dy = pattern.direction.y - pattern.object.y;
  const length = Math.max(Math.hypot(dx, dy), 0.001);
  const target = {
    x: clamp(pattern.object.x + (dx / length) * config.travel),
    y: clamp(pattern.object.y + (dy / length) * config.travel),
  };

  return { object: pattern.object, target, config };
}

type Phase = 'idle' | 'running' | 'between' | 'complete';

type DomainKey = 'reach' | 'hand' | 'coordination' | 'digital';

type Props = {
  initialDomainScore: number;
  domainKey?: DomainKey;
  onComplete?: (session: TrainingSessionResult) => void;
  onReassess?: () => void;
  onBack?: () => void;
};

export function AdaptivePrecisionTraining({
  initialDomainScore,
  domainKey = 'hand',
  onComplete,
  onReassess,
  onBack,
}: Props) {
  const { t, tm } = useI18n();
  const focusLabel = t(`domain.${domainKey}`);
  const moduleName = t(`moduleName.${domainKey}`);
  const startingLevel = useMemo(
    () => startingLevelFromDomainScore(initialDomainScore),
    [initialDomainScore],
  );

  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState<TrainingLevel>(startingLevel);
  const [challengeBoost, setChallengeBoost] = useState(0);
  const [highStreak, setHighStreak] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [trialIndex, setTrialIndex] = useState(0);
  const [objectPos, setObjectPos] = useState<Point2D>({ x: 0.23, y: 0.70 });
  const [targetPos, setTargetPos] = useState<Point2D>({ x: 0.70, y: 0.30 });
  const [message, setMessage] = useState<Msg>('tr.msg.idle');
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [adaptations, setAdaptations] = useState<string[]>([]);
  const [pendingAdaptation, setPendingAdaptation] = useState<TrainingAdaptation | null>(null);
  const [lastTrial, setLastTrial] = useState<TrainingTrial | null>(null);
  const [lastRound, setLastRound] = useState<ReturnType<typeof scoreTrainingRound> | null>(null);
  const [sessionResult, setSessionResult] = useState<TrainingSessionResult | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startPointRef = useRef<Point2D>({ x: 0, y: 0 });
  const lastPointRef = useRef<Point2D | null>(null);
  const pathLengthRef = useRef(0);
  const trialStartedAtRef = useRef<number | null>(null);
  const roundTrialsRef = useRef<TrainingTrial[]>([]);

  const currentSpec = useMemo(
    () => makeTrialSpec(level, challengeBoost, roundIndex, trialIndex),
    [level, challengeBoost, roundIndex, trialIndex],
  );

  useEffect(() => {
    setLevel(startingLevel);
  }, [startingLevel]);

  function resetObjectForCurrentTrial(
    nextLevel = level,
    nextBoost = challengeBoost,
    nextRound = roundIndex,
    nextTrial = trialIndex,
  ) {
    const spec = makeTrialSpec(nextLevel, nextBoost, nextRound, nextTrial);
    setObjectPos(spec.object);
    setTargetPos(spec.target);
    startPointRef.current = spec.object;
    lastPointRef.current = null;
    pathLengthRef.current = 0;
    trialStartedAtRef.current = null;
    draggingRef.current = false;
    pointerIdRef.current = null;
  }

  function startSession() {
    const freshLevel = startingLevelFromDomainScore(initialDomainScore);
    setLevel(freshLevel);
    setChallengeBoost(0);
    setHighStreak(0);
    setRoundIndex(0);
    setTrialIndex(0);
    setRoundScores([]);
    setAdaptations([]);
    setPendingAdaptation(null);
    setLastTrial(null);
    setLastRound(null);
    setSessionResult(null);
    roundTrialsRef.current = [];
    resetObjectForCurrentTrial(freshLevel, 0, 0, 0);
    setMessage('tr.msg.start');
    setPhase('running');
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLElement>): Point2D | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0.02, 0.98),
      y: clamp((event.clientY - rect.top) / rect.height, 0.02, 0.98),
    };
  }

  function stageDistance(a: Point2D, b: Point2D) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return distance(a, b);
    const dx = (a.x - b.x) * rect.width;
    const dy = (a.y - b.y) * rect.height;
    // Normalize back to stage-width units so targetRadius remains interpretable.
    return Math.hypot(dx, dy) / rect.width;
  }

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (phase !== 'running') return;
    const point = pointFromEvent(event);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;
    lastPointRef.current = point;
    pathLengthRef.current = 0;
    trialStartedAtRef.current = performance.now();
    setMessage('tr.msg.drag');
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current || pointerIdRef.current !== event.pointerId || phase !== 'running') return;
    const point = pointFromEvent(event);
    if (!point) return;

    const last = lastPointRef.current;
    if (last) pathLengthRef.current += stageDistance(last, point);
    lastPointRef.current = point;
    setObjectPos(point);
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current || pointerIdRef.current !== event.pointerId || phase !== 'running') return;
    const release = pointFromEvent(event) ?? objectPos;
    draggingRef.current = false;
    pointerIdRef.current = null;

    const elapsedSeconds = Math.max(
      0.15,
      ((performance.now() - (trialStartedAtRef.current ?? performance.now())) / 1000),
    );
    const targetError = stageDistance(release, targetPos);
    const accuracy = Math.max(0, 1 - targetError / (currentSpec.config.targetRadius * 1.55));
    const success = targetError <= currentSpec.config.targetRadius;
    const straightDistance = Math.max(stageDistance(startPointRef.current, targetPos), 0.001);
    const actualPath = Math.max(pathLengthRef.current, straightDistance, 0.001);
    const pathEfficiency = Math.min(1, straightDistance / actualPath);
    const pace = Math.min(1, currentSpec.config.referenceSeconds / elapsedSeconds);

    const trial: TrainingTrial = {
      accuracy,
      pathEfficiency,
      pace,
      success,
      elapsedSeconds,
    };
    setLastTrial(trial);

    const updatedTrials = [...roundTrialsRef.current, trial];
    roundTrialsRef.current = updatedTrials;

    if (trialIndex + 1 < TRIALS_PER_ROUND) {
      const nextTrial = trialIndex + 1;
      setMessage(success ? 'tr.msg.placed' : 'tr.msg.close');
      setTrialIndex(nextTrial);
      resetObjectForCurrentTrial(level, challengeBoost, roundIndex, nextTrial);
      return;
    }

    const roundResult = scoreTrainingRound(updatedTrials);
    const adaptation = adaptTrainingDifficulty({
      level,
      roundScore: roundResult.score,
      highStreak,
      challengeBoost,
    });
    const nextScores = [...roundScores, roundResult.score];
    const nextAdaptations = [...adaptations, adaptation.message];

    setRoundScores(nextScores);
    setAdaptations(nextAdaptations);
    setLastRound(roundResult);
    setPendingAdaptation(adaptation);
    setMessage({ k: adaptation.messageKey, p: adaptation.messageParams });
    setPhase(roundIndex + 1 >= ROUNDS ? 'complete' : 'between');

    if (roundIndex + 1 >= ROUNDS) {
      const averageScore = Math.round(nextScores.reduce((sum, value) => sum + value, 0) / nextScores.length);
      const result: TrainingSessionResult = {
        domainKey,
        module: `${moduleName} · ${t('coach.tl.adaptiveSuffix')}`,
        focus: focusLabel,
        startingLevel,
        finalLevel: adaptation.level,
        roundScores: nextScores,
        bestScore: Math.max(...nextScores),
        averageScore,
        completedRounds: ROUNDS,
        adaptations: nextAdaptations,
      };
      setLevel(adaptation.level);
      setChallengeBoost(adaptation.challengeBoost);
      setHighStreak(adaptation.highStreak);
      setSessionResult(result);
      onComplete?.(result);
    }
  }

  function continueRound() {
    if (!pendingAdaptation) return;
    const nextRound = roundIndex + 1;
    const nextLevel = pendingAdaptation.level;
    const nextBoost = pendingAdaptation.challengeBoost;

    setLevel(nextLevel);
    setChallengeBoost(nextBoost);
    setHighStreak(pendingAdaptation.highStreak);
    setRoundIndex(nextRound);
    setTrialIndex(0);
    roundTrialsRef.current = [];
    setPendingAdaptation(null);
    setLastTrial(null);
    resetObjectForCurrentTrial(nextLevel, nextBoost, nextRound, 0);
    setMessage({ k: 'tr.msg.nextRound', p: { round: nextRound + 1, level: nextLevel } });
    setPhase('running');
  }

  const liveConfig = phase === 'between' && pendingAdaptation
    ? trainingLevelConfig(pendingAdaptation.level, pendingAdaptation.challengeBoost)
    : currentSpec.config;

  const targetDiameter = `${liveConfig.targetRadius * 200}%`;
  const lastAccuracy = lastTrial ? Math.round(lastTrial.accuracy * 100) : 0;
  const lastPath = lastTrial ? Math.round(lastTrial.pathEfficiency * 100) : 0;
  const lastPace = lastTrial ? Math.round(lastTrial.pace * 100) : 0;

  return (
    <section className="adaptive-training-shell">
      <div className="training-header-row">
        <div>
          <div className="eyebrow">{t('tr.eyebrow')}</div>
          <h1>{moduleName}</h1>
          <p>
            {t('tr.intro1')}<b>{focusLabel}</b>{t('tr.intro2')}
          </p>
        </div>
        <div className="training-entry-card">
          <span>{t('tr.entry')}</span>
          <strong>{t('tr.level', { n: startingLevel })}</strong>
          <small>{t('tr.entryNote', { focus: focusLabel.toLowerCase(), score: initialDomainScore })}</small>
        </div>
      </div>

      <div className="training-workspace-grid">
        <article className="training-stage-card">
          <div className="training-stage-topline">
            <div>
              <span>{t('tr.roundOf', { n: Math.min(roundIndex + 1, ROUNDS), m: ROUNDS })}</span>
              <strong>{t('tr.levelLine', { n: level, label: t(`tr.levelName.${level}`) })}</strong>
            </div>
            <div className="training-trial-dots" aria-label={t('tr.trialAria')}>
              {Array.from({ length: TRIALS_PER_ROUND }).map((_, index) => (
                <i key={index} className={index < trialIndex ? 'done' : index === trialIndex && phase === 'running' ? 'active' : ''} />
              ))}
            </div>
          </div>

          <div
            className={`adaptive-stage phase-${phase}`}
            ref={stageRef}
            aria-label={t('tr.stageAria')}
          >
            {phase === 'idle' && (
              <div className="training-overlay-card">
                <span>{t('tr.ready')}</span>
                <strong>{t('tr.readyTitle')}</strong>
                <p>{t('tr.readyText')}</p>
                <button className="primary-btn light-btn" onClick={startSession}>{t('tr.startSession')}</button>
              </div>
            )}

            {(phase === 'running' || phase === 'between') && (
              <>
                <div
                  className="adaptive-target"
                  style={{
                    left: `${targetPos.x * 100}%`,
                    top: `${targetPos.y * 100}%`,
                    width: targetDiameter,
                    aspectRatio: '1',
                  }}
                >
                  <span>{t('tr.target')}</span>
                </div>
                <div
                  className="training-guide-line"
                  style={{
                    left: `${Math.min(objectPos.x, targetPos.x) * 100}%`,
                    top: `${Math.min(objectPos.y, targetPos.y) * 100}%`,
                    width: `${Math.abs(targetPos.x - objectPos.x) * 100}%`,
                    height: `${Math.abs(targetPos.y - objectPos.y) * 100}%`,
                  }}
                />
                <button
                  className="adaptive-object"
                  aria-label={t('tr.objectAria')}
                  style={{ left: `${objectPos.x * 100}%`, top: `${objectPos.y * 100}%` }}
                  onPointerDown={beginDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  disabled={phase !== 'running'}
                >
                  <span>●</span>
                </button>
              </>
            )}

            {phase === 'between' && lastRound && (
              <div className="round-overlay">
                <span className="round-kicker">{t('tr.roundComplete', { n: roundIndex + 1 })}</span>
                <strong>{lastRound.score}</strong>
                <small>{t('tr.scoreLabel')}</small>
                <p>{pendingAdaptation && tm({ k: pendingAdaptation.messageKey, p: pendingAdaptation.messageParams })}</p>
                <button className="primary-btn light-btn" onClick={continueRound}>{t('tr.applyContinue')}</button>
              </div>
            )}

            {phase === 'complete' && sessionResult && (
              <div className="round-overlay complete-overlay">
                <span className="round-kicker">{t('tr.sessionComplete')}</span>
                <strong>{sessionResult.averageScore}</strong>
                <small>{t('tr.avgPerformance')}</small>
                <div className="completion-mini-grid">
                  <div><span>{t('tr.bestRound')}</span><b>{sessionResult.bestScore}</b></div>
                  <div><span>{t('tr.startLevel')}</span><b>L{sessionResult.startingLevel}</b></div>
                  <div><span>{t('tr.finishLevel')}</span><b>L{sessionResult.finalLevel}</b></div>
                </div>
                <p>{t('tr.separateNote')}</p>
                <div className="training-complete-actions">
                  <button className="primary-btn light-btn" onClick={onReassess}>{t('tr.reassess')}</button>
                  <button className="ghost-light-btn" onClick={startSession}>{t('tr.repeat')}</button>
                </div>
              </div>
            )}
          </div>

          <div className="training-message-row">
            <div><span>{t('tr.coachLabel')}</span><strong>{tm(message)}</strong></div>
            <button className="text-reset" onClick={startSession}>{phase === 'idle' ? t('tr.start') : t('tr.restart')}</button>
          </div>
        </article>

        <aside className="training-side-panel">
          <div className="training-level-card">
            <div className="card-kicker">{t('tr.liveDifficulty')}</div>
            <div className="level-number"><strong>{phase === 'between' && pendingAdaptation ? pendingAdaptation.level : level}</strong><span>/4</span></div>
            <div className="difficulty-row"><span>{t('tr.targetSize')}</span><b>{Math.round(liveConfig.targetRadius * 200)}%</b></div>
            <div className="difficulty-row"><span>{t('tr.travel')}</span><b>{Math.round(liveConfig.travel * 100)}</b></div>
            <div className="difficulty-row"><span>{t('tr.refPace')}</span><b>{liveConfig.referenceSeconds.toFixed(1)}s</b></div>
          </div>

          <div className="training-metric-grid">
            <div><span>{t('tr.accuracy')}</span><strong>{lastAccuracy || '—'}</strong></div>
            <div><span>{t('tr.path')}</span><strong>{lastPath || '—'}</strong></div>
            <div><span>{t('tr.pace')}</span><strong>{lastPace || '—'}</strong></div>
            <div><span>{t('tr.rounds')}</span><strong>{roundScores.length}/{ROUNDS}</strong></div>
          </div>

          <div className="adaptive-rules-card">
            <div className="card-kicker">{t('tr.rulesKicker')}</div>
            <div><b>{t('tr.rule1')}</b><span>{t('tr.rule1d')}</span></div>
            <div><b>{t('tr.rule2')}</b><span>{t('tr.rule2d')}</span></div>
            <div><b>{t('tr.rule3')}</b><span>{t('tr.rule3d')}</span></div>
            <div><b>{t('tr.rule4')}</b><span>{t('tr.rule4d')}</span></div>
          </div>

          <div className="round-history-card">
            <div className="card-kicker">{t('tr.historyKicker')}</div>
            {roundScores.length ? roundScores.map((score, index) => (
              <div className="round-history-row" key={`${score}-${index}`}>
                <span>{t('tr.round', { n: index + 1 })}</span>
                <div><i style={{ width: `${score}%` }} /></div>
                <strong>{score}</strong>
              </div>
            )) : <p>{t('tr.noRounds')}</p>}
          </div>
        </aside>
      </div>

      <div className="training-boundary-note">
        <div>
          <strong>{t('tr.note1.title')}</strong>
          <p>{t('tr.note1.text')}</p>
        </div>
        <div>
          <strong>{t('tr.note2.title')}</strong>
          <p>{t('tr.note2.text')}</p>
        </div>
        {onBack && <button className="secondary-btn" onClick={onBack}>{t('tr.back')}</button>}
      </div>
    </section>
  );
}
