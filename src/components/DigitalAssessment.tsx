import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react';
import { MetricCard } from './MetricCard';
import { scoreDigitalWork } from '../lib/digitalScoring';
import type { DigitalMetrics } from '../types/assessment';

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
  const [message, setMessage] = useState('Three short tasks: target clicks, drag-and-drop, and typing.');
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
    setMessage('Task 1/3 · Click each highlighted target. Accuracy matters more than speed.');
  };

  const registerTarget = (correct: boolean) => {
    if (phase !== 'targets') return;
    setTargetAttempts((value) => value + 1);
    if (!correct) {
      setMessage('Miss recorded · Find the highlighted target and continue.');
      return;
    }

    const nextCorrect = correctTargets + 1;
    setCorrectTargets(nextCorrect);
    if (nextCorrect >= TARGETS.length) {
      setPhase('drag');
      setMessage('Task 2/3 · Drag each file into its matching folder.');
    } else {
      setTargetIndex((value) => value + 1);
      setMessage(`Target ${nextCorrect}/${TARGETS.length} complete · Continue.`);
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
      setMessage(`${file.label} placed correctly.`);
      if (nextCompleted.length === FILES.length) {
        setPhase('typing');
        setMessage('Task 3/3 · Type the phrase exactly as shown. Corrections are allowed.');
      }
    } else {
      setMessage(`Not the matching folder for ${file.label}. Try again.`);
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
      setMessage('Digital work simulation complete.');
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
          <div className="eyebrow">Test 03 · Digital Work Simulation</div>
          <h2>Measure task interaction — not a medical diagnosis.</h2>
          <p>
            A short browser-based simulation combines target selection, drag-and-drop,
            and typing to produce an interpretable Digital Control score.
          </p>
        </div>
        <div className={`status-pill status-${phase === 'complete' ? 'complete' : phase === 'idle' ? 'ready' : 'running'}`}>
          {phase === 'complete' ? 'Complete' : phase === 'idle' ? 'Ready' : `Task ${phaseNumber}/3`}
        </div>
      </div>

      <div className="assessment-grid digital-grid">
        <div className="camera-card digital-work-card">
          <div className="digital-stage">
            {phase === 'idle' && (
              <div className="digital-intro">
                <span>03</span>
                <h3>Digital Work Simulation</h3>
                <p>6 target clicks · 3 drag-and-drop actions · 1 short typing phrase</p>
                <button className="primary-btn" onClick={start}>Start Digital Test</button>
              </div>
            )}

            {phase === 'targets' && (
              <div className="target-task" onClick={() => registerTarget(false)}>
                <div className="task-banner">
                  <strong>Targeting</strong>
                  <span>{correctTargets}/{TARGETS.length}</span>
                </div>
                {TARGETS.map((target, index) => index === targetIndex ? (
                  <button
                    key={index}
                    className="digital-target"
                    style={{ left: `${target.x}%`, top: `${target.y}%` }}
                    aria-label={`Target ${index + 1}`}
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
                  <strong>Drag & Drop</strong>
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
                      <span>FILE</span>
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
                      <span>FOLDER</span>
                      <strong>{folder}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase === 'typing' && (
              <div className="typing-task">
                <div className="task-banner">
                  <strong>Typing</strong>
                  <span>Final task</span>
                </div>
                <div className="typing-center">
                  <span className="typing-label">TYPE THIS PHRASE</span>
                  <div className="typing-prompt">{TYPING_PROMPT}</div>
                  <input
                    autoFocus
                    value={typingValue}
                    onKeyDown={handleTypingKey}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => handleTypingChange(event.target.value.toUpperCase())}
                    onPaste={(event: ClipboardEvent<HTMLInputElement>) => event.preventDefault()}
                    spellCheck={false}
                    aria-label="Typing task"
                    placeholder="Start typing…"
                  />
                  <small>{typingValue.length}/{TYPING_PROMPT.length} characters</small>
                </div>
              </div>
            )}

            {phase === 'complete' && metrics && (
              <div className="digital-complete">
                <span className="complete-kicker">DIGITAL CONTROL</span>
                <strong>{metrics.digitalControlScore}</strong>
                <p>HIMAM task-performance score</p>
                <button className="secondary-btn" onClick={start}>Run Test Again</button>
              </div>
            )}
          </div>

          <div className="digital-message-row">
            <div>
              <span>Live guidance</span>
              <strong>{message}</strong>
            </div>
            {phase !== 'idle' && phase !== 'complete' && (
              <button className="text-reset" onClick={start}>Restart</button>
            )}
          </div>
        </div>

        <aside className="results-panel">
          <div className="progress-line">
            <strong>Digital assessment</strong>
            <span>{phase === 'complete' ? 'Done' : `${overallProgress}%`}</span>
          </div>
          <div className="mini-progress"><div style={{ width: `${overallProgress}%` }} /></div>

          <div className="metric-grid">
            <MetricCard
              label="Target accuracy"
              value={metrics?.targetAccuracy ?? liveTargetAccuracy}
              hint="Correct targets / click attempts"
            />
            <MetricCard
              label="Drag success"
              value={metrics?.dragSuccess ?? liveDragSuccess}
              hint="Correct placements / drop attempts"
            />
            <MetricCard
              label="Typing accuracy"
              value={metrics?.typingAccuracy ?? 0}
              hint="Correct character keypresses"
            />
            <MetricCard
              label="Pace"
              value={metrics?.pace ?? 0}
              hint="60-second prototype reference"
            />
          </div>

          {metrics && (
            <div className="digital-score-card">
              <span>Digital Control Score</span>
              <strong>{metrics.digitalControlScore}</strong>
              <small>{metrics.elapsedSeconds}s total simulation time</small>
            </div>
          )}

          <div className="safety-note">
            <strong>Prototype interpretation</strong>
            <p>
              This score reflects performance inside these simulated tasks only. It is not
              a medical assessment, disability rating, or fitness-for-work decision.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
