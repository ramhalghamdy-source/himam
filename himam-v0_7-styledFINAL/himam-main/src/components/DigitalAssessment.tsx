import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react';
import { MetricCard } from './MetricCard';
import { scoreDigitalWork } from '../lib/digitalScoring';
import type { DigitalMetrics } from '../types/assessment';
import { useI18n, type Msg } from '../i18n';
import type { TKey } from '../i18n/translations';

type Props = {
  onComplete: (metrics: DigitalMetrics) => void;
};

type Phase = 'idle' | 'targets' | 'drag' | 'typing' | 'complete';

const TARGETS = [
  { x: 18, y: 28 },
  { x: 72, y: 20 },
  { x: 50, y: 48 },
  { x: 82, y: 70 },
  { x: 24, y: 76 },
  { x: 62, y: 82 },
];

const FILES = [
  { id: 'cv', label: 'CV.pdf', destination: 'Applications' },
  { id: 'report', label: 'Report.docx', destination: 'Reports' },
  { id: 'notes', label: 'Notes.txt', destination: 'Notes' },
];

const FOLDERS = ['Applications', 'Reports', 'Notes'];
const TYPING_PROMPT = 'HIMAM 2026 READY';

export function DigitalAssessment({ onComplete }: Props) {
  const { t, tm } = useI18n();
  const [phase, setPhase] = useState<Phase>('idle');
  const [targetIndex, setTargetIndex] = useState(0);
  const [targetAttempts, setTargetAttempts] = useState(0);
  const [correctTargets, setCorrectTargets] = useState(0);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [completedFiles, setCompletedFiles] = useState<string[]>([]);
  const [dropAttempts, setDropAttempts] = useState(0);
  const [typingValue, setTypingValue] = useState('');
  const [keypressAttempts, setKeypressAttempts] = useState(0);
  const [correctKeypresses, setCorrectKeypresses] = useState(0);
  const [metrics, setMetrics] = useState<DigitalMetrics | null>(null);
  const [message, setMessage] = useState<Msg>('dig.msg.intro');
  const startedAt = useRef<number | null>(null);
  const keypressAttemptsRef = useRef(0);
  const correctKeypressesRef = useRef(0);

  const phaseNumber = phase === 'idle' ? 0 : phase === 'targets' ? 1 : phase === 'drag' ? 2 : phase === 'typing' ? 3 : 3;
  const overallProgress = phase === 'complete' ? 100 : Math.round((phaseNumber / 3) * 100);

  const reset = () => {
    setTargetIndex(0);
    setTargetAttempts(0);
    setCorrectTargets(0);
    setDraggedId(null);
    setCompletedFiles([]);
    setDropAttempts(0);
    setTypingValue('');
    setKeypressAttempts(0);
    setCorrectKeypresses(0);
    keypressAttemptsRef.current = 0;
    correctKeypressesRef.current = 0;
    setMetrics(null);
  };

  const start = () => {
    reset();
    startedAt.current = performance.now();
    setPhase('targets');
    setMessage('dig.msg.task1');
  };

  const registerTarget = (correct: boolean) => {
    if (phase !== 'targets') return;
    setTargetAttempts((value) => value + 1);
    if (!correct) {
      setMessage('dig.msg.miss');
      return;
    }

    const nextCorrect = correctTargets + 1;
    setCorrectTargets(nextCorrect);
    if (nextCorrect >= TARGETS.length) {
      setPhase('drag');
      setMessage('dig.msg.task2');
    } else {
      setTargetIndex((value) => value + 1);
      setMessage({ k: 'dig.msg.targetDone', p: { n: nextCorrect, m: TARGETS.length } });
    }
  };

  const handleDrop = (folder: string) => {
    if (phase !== 'drag' || !draggedId) return;
    setDropAttempts((value) => value + 1);
    const file = FILES.find((item) => item.id === draggedId);
    if (!file) return;

    if (file.destination === folder) {
      const nextCompleted = [...completedFiles, draggedId];
      setCompletedFiles(nextCompleted);
      setMessage({ k: 'dig.msg.placed', p: { file: file.label } });
      if (nextCompleted.length === FILES.length) {
        setPhase('typing');
        setMessage('dig.msg.task3');
      }
    } else {
      setMessage({ k: 'dig.msg.wrongFolder', p: { file: file.label } });
    }
    setDraggedId(null);
  };

  const handleTypingKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (phase !== 'typing' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;

    const expected = TYPING_PROMPT[typingValue.length];
    keypressAttemptsRef.current += 1;
    setKeypressAttempts(keypressAttemptsRef.current);
    if (event.key.toUpperCase() === expected) {
      correctKeypressesRef.current += 1;
      setCorrectKeypresses(correctKeypressesRef.current);
    }
  };

  const handleTypingChange = (value: string) => {
    if (phase !== 'typing') return;
    const limited = value.slice(0, TYPING_PROMPT.length);
    setTypingValue(limited);

    if (limited === TYPING_PROMPT) {
      const elapsedSeconds = startedAt.current
        ? (performance.now() - startedAt.current) / 1000
        : 60;
      const result = scoreDigitalWork({
        correctTargets,
        targetAttempts,
        correctDrops: completedFiles.length,
        dropAttempts,
        correctKeypresses: correctKeypressesRef.current,
        keypressAttempts: keypressAttemptsRef.current,
        elapsedSeconds,
      });
      setMetrics(result);
      setPhase('complete');
      setMessage('dig.msg.complete');
      onComplete(result);
    }
  };

  const liveTargetAccuracy = useMemo(() => (
    targetAttempts > 0 ? Math.round((correctTargets / targetAttempts) * 100) : 0
  ), [correctTargets, targetAttempts]);

  const liveDragSuccess = useMemo(() => (
    dropAttempts > 0 ? Math.round((completedFiles.length / dropAttempts) * 100) : 0
  ), [completedFiles.length, dropAttempts]);

  return (
    <section className="assessment-shell digital-assessment">
      <div className="assessment-header">
        <div>
          <div className="eyebrow">{t('dig.eyebrow')}</div>
          <h2>{t('dig.title')}</h2>
          <p>{t('dig.p')}</p>
        </div>
        <div className={`status-pill status-${phase === 'complete' ? 'complete' : phase === 'idle' ? 'ready' : 'running'}`}>
          {phase === 'complete' ? t('dig.pillComplete') : phase === 'idle' ? t('dig.pillReady') : t('dig.pillTask', { n: phaseNumber })}
        </div>
      </div>

      <div className="assessment-grid digital-grid">
        <div className="camera-card digital-work-card">
          <div className="digital-stage">
            {phase === 'idle' && (
              <div className="digital-intro">
                <span>03</span>
                <h3>{t('dig.introTitle')}</h3>
                <p>{t('dig.introText')}</p>
                <button className="primary-btn" onClick={start}>{t('dig.startTest')}</button>
              </div>
            )}

            {phase === 'targets' && (
              <div className="target-task" onClick={() => registerTarget(false)}>
                <div className="task-banner">
                  <strong>{t('dig.targeting')}</strong>
                  <span>{correctTargets}/{TARGETS.length}</span>
                </div>
                {TARGETS.map((target, index) => index === targetIndex ? (
                  <button
                    key={index}
                    className="digital-target"
                    style={{ left: `${target.x}%`, top: `${target.y}%` }}
                    aria-label={t('dig.targetAria', { n: index + 1 })}
                    onClick={(event: MouseEvent<HTMLButtonElement>) => {
                      event.stopPropagation();
                      registerTarget(true);
                    }}
                  >
                    <span>{index + 1}</span>
                  </button>
                ) : null)}
              </div>
            )}

            {phase === 'drag' && (
              <div className="drag-task">
                <div className="task-banner">
                  <strong>{t('dig.dragDrop')}</strong>
                  <span>{completedFiles.length}/{FILES.length}</span>
                </div>
                <div className="file-tray">
                  {FILES.filter((file) => !completedFiles.includes(file.id)).map((file) => (
                    <div
                      key={file.id}
                      draggable
                      className={`draggable-file ${draggedId === file.id ? 'selected' : ''}`}
                      onClick={() => setDraggedId(file.id)}
                      onDragStart={() => setDraggedId(file.id)}
                      onDragEnd={() => setDraggedId(null)}
                    >
                      <span>{t('dig.file')}</span>
                      <strong>{file.label}</strong>
                    </div>
                  ))}
                </div>
                <div className="folder-grid">
                  {FOLDERS.map((folder) => (
                    <div
                      key={folder}
                      className="drop-folder"
                      onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                      onDrop={(event: DragEvent<HTMLDivElement>) => {
                        event.preventDefault();
                        handleDrop(folder);
                      }}
                      onClick={() => handleDrop(folder)}
                    >
                      <span>{t('dig.folder')}</span>
                      <strong>{t(`dig.folder.${folder}` as TKey)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase === 'typing' && (
              <div className="typing-task">
                <div className="task-banner">
                  <strong>{t('dig.typing')}</strong>
                  <span>{t('dig.finalTask')}</span>
                </div>
                <div className="typing-center">
                  <span className="typing-label">{t('dig.typePhrase')}</span>
                  <div className="typing-prompt">{TYPING_PROMPT}</div>
                  <input
                    autoFocus
                    value={typingValue}
                    onKeyDown={handleTypingKey}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => handleTypingChange(event.target.value.toUpperCase())}
                    onPaste={(event: ClipboardEvent<HTMLInputElement>) => event.preventDefault()}
                    spellCheck={false}
                    aria-label={t('dig.typingAria')}
                    placeholder={t('dig.typingPlaceholder')}
                  />
                  <small>{t('dig.characters', { n: typingValue.length, m: TYPING_PROMPT.length })}</small>
                </div>
              </div>
            )}

            {phase === 'complete' && metrics && (
              <div className="digital-complete">
                <span className="complete-kicker">{t('dig.completeKicker')}</span>
                <strong>{metrics.digitalControlScore}</strong>
                <p>{t('dig.completeSub')}</p>
                <button className="secondary-btn" onClick={start}>{t('dig.runAgain')}</button>
              </div>
            )}
          </div>

          <div className="digital-message-row">
            <div>
              <span>{t('dig.liveGuidance')}</span>
              <strong>{tm(message)}</strong>
            </div>
            {phase !== 'idle' && phase !== 'complete' && (
              <button className="text-reset" onClick={start}>{t('dig.restart')}</button>
            )}
          </div>
        </div>

        <aside className="results-panel">
          <div className="progress-line">
            <strong>{t('dig.assessment')}</strong>
            <span>{phase === 'complete' ? t('dig.done') : `${overallProgress}%`}</span>
          </div>
          <div className="mini-progress"><div style={{ width: `${overallProgress}%` }} /></div>

          <div className="metric-grid">
            <MetricCard
              label={t('dig.metric.target')}
              value={metrics?.targetAccuracy ?? liveTargetAccuracy}
              hint={t('dig.metric.targetHint')}
            />
            <MetricCard
              label={t('dig.metric.drag')}
              value={metrics?.dragSuccess ?? liveDragSuccess}
              hint={t('dig.metric.dragHint')}
            />
            <MetricCard
              label={t('dig.metric.typing')}
              value={metrics?.typingAccuracy ?? 0}
              hint={t('dig.metric.typingHint')}
            />
            <MetricCard
              label={t('dig.metric.pace')}
              value={metrics?.pace ?? 0}
              hint={t('dig.metric.paceHint')}
            />
          </div>

          {metrics && (
            <div className="digital-score-card">
              <span>{t('dig.scoreLabel')}</span>
              <strong>{metrics.digitalControlScore}</strong>
              <small>{t('dig.totalTime', { n: metrics.elapsedSeconds })}</small>
            </div>
          )}

          <div className="safety-note">
            <strong>{t('common.interpretation')}</strong>
            <p>{t('dig.note')}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
