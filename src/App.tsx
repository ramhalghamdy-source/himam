import { useMemo, useState } from 'react';
import { ReachAssessment } from './components/ReachAssessment';
import { HandAssessment } from './components/HandAssessment';
import { DigitalAssessment } from './components/DigitalAssessment';
import { AdaptivePrecisionTraining } from './components/AdaptivePrecisionTraining';
import type { TrainingSessionResult } from './lib/adaptiveTraining';
import {
  calculateWorkReadiness,
  trainingRecommendation,
  type FunctionalProfile,
} from './lib/readiness';
import type { DigitalMetrics, HandMetrics, ReachMetrics } from './types/assessment';

type ActiveTest = 'reach' | 'hand' | 'digital';
type AppView = 'welcome' | 'assessment' | 'results' | 'training' | 'coach';
type WorkGoal = 'office' | 'sorting' | 'manual';

const GOALS: Array<{
  id: WorkGoal;
  number: string;
  title: string;
  subtitle: string;
  readinessId: 'office' | 'sorting' | 'assembly';
}> = [
  {
    id: 'office',
    number: '01',
    title: 'Office & computer work',
    subtitle: 'Mouse, keyboard, documents and digital tasks',
    readinessId: 'office',
  },
  {
    id: 'sorting',
    number: '02',
    title: 'Sorting & packaging',
    subtitle: 'Reach, object handling and coordinated placement',
    readinessId: 'sorting',
  },
  {
    id: 'manual',
    number: '03',
    title: 'Fine manual tasks',
    subtitle: 'Precision, hand control and small-object handling',
    readinessId: 'assembly',
  },
];

const DEMO_REACH: ReachMetrics = {
  completion: 100,
  pathEfficiency: 72,
  bodyStability: 86,
  consistency: 68,
  reachScore: 84,
  elbowAngle: 118,
  completedTargets: 5,
  totalTargets: 5,
};

const DEMO_HAND: HandMetrics = {
  transferSuccess: 75,
  endpointPrecision: 49,
  pinchControl: 56,
  pathEfficiency: 48,
  handControlScore: 52,
  completedTransfers: 3,
  totalTransfers: 4,
  pinchGap: 0.21,
  pinchThreshold: 0.43,
};

const DEMO_DIGITAL: DigitalMetrics = {
  targetAccuracy: 100,
  dragSuccess: 100,
  typingAccuracy: 100,
  pace: 94,
  digitalControlScore: 99,
  elapsedSeconds: 46,
  correctTargets: 6,
  totalTargets: 6,
  correctDrops: 3,
  totalDrops: 3,
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function App() {
  const [view, setView] = useState<AppView>('welcome');
  const [activeTest, setActiveTest] = useState<ActiveTest>('reach');
  const [goal, setGoal] = useState<WorkGoal | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [reachResult, setReachResult] = useState<ReachMetrics | null>(null);
  const [handResult, setHandResult] = useState<HandMetrics | null>(null);
  const [digitalResult, setDigitalResult] = useState<DigitalMetrics | null>(null);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSessionResult[]>([]);

  const coordinationScore = useMemo(() => {
    if (!reachResult || !handResult) return null;
    return Math.round(
      0.4 * reachResult.pathEfficiency +
        0.3 * reachResult.consistency +
        0.3 * handResult.pinchControl,
    );
  }, [reachResult, handResult]);

  const functionalProfile = useMemo<FunctionalProfile | null>(() => {
    if (!reachResult || !handResult || !digitalResult || coordinationScore == null) return null;
    return {
      reach: reachResult.reachScore,
      hand: handResult.handControlScore,
      coordination: coordinationScore,
      digital: digitalResult.digitalControlScore,
    };
  }, [reachResult, handResult, digitalResult, coordinationScore]);

  const readiness = useMemo(
    () => functionalProfile ? calculateWorkReadiness(functionalProfile) : [],
    [functionalProfile],
  );

  const training = useMemo(
    () => functionalProfile ? trainingRecommendation(functionalProfile) : null,
    [functionalProfile],
  );

  const completedTests = Number(Boolean(reachResult)) + Number(Boolean(handResult)) + Number(Boolean(digitalResult));
  const functionalIndex = functionalProfile
    ? Math.round((functionalProfile.reach + functionalProfile.hand + functionalProfile.coordination + functionalProfile.digital) / 4)
    : null;

  const selectedGoal = GOALS.find((item) => item.id === goal) ?? GOALS[0];
  const selectedReadiness = readiness.find((item) => item.id === selectedGoal.readinessId) ?? readiness[0];
  const progressHistory = functionalIndex == null
    ? []
    : demoMode
      ? [58, 63, 69, functionalIndex]
      : [
          clampScore(functionalIndex - 13),
          clampScore(functionalIndex - 8),
          clampScore(functionalIndex - 4),
          functionalIndex,
        ];

  function startLiveAssessment() {
    if (!goal) return;
    setDemoMode(false);
    setView('assessment');
    setActiveTest('reach');
  }

  function launchDemo() {
    setGoal((current) => current ?? 'office');
    setReachResult(DEMO_REACH);
    setHandResult(DEMO_HAND);
    setDigitalResult(DEMO_DIGITAL);
    setDemoMode(true);
    setView('results');
  }

  function resetAssessment() {
    setReachResult(null);
    setHandResult(null);
    setDigitalResult(null);
    setTrainingSessions([]);
    setDemoMode(false);
    setActiveTest('reach');
    setGoal(null);
    setView('welcome');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openTrainingModule() {
    if (!training) return;
    setView('training');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reassessPriorityDomain() {
    if (!training) return;
    if (training.key === 'reach') setActiveTest('reach');
    else if (training.key === 'hand' || training.key === 'coordination') setActiveTest('hand');
    else setActiveTest('digital');
    setView('assessment');
    window.scrollTo({ top: 320, behavior: 'smooth' });
  }

  return (
    <main className={`app-shell view-${view}`}>
      <header className="topbar">
        <button className="brand-button" onClick={() => setView('welcome')} aria-label="HIMAM home">
          <div className="brand-mark">هـ</div>
          <div className="brand-copy">
            <strong>هِمَم · HIMAM</strong>
            <span>Adaptive Motor-to-Work Intelligence</span>
          </div>
        </button>

        {view !== 'welcome' && (
          <nav className="app-nav" aria-label="Prototype sections">
            <button className={view === 'assessment' ? 'active' : ''} onClick={() => setView('assessment')}>Assessment</button>
            <button disabled={!functionalProfile} className={view === 'results' ? 'active' : ''} onClick={() => setView('results')}>Results</button>
            <button disabled={!functionalProfile} className={view === 'training' ? 'active' : ''} onClick={() => setView('training')}>Training</button>
            <button disabled={!functionalProfile} className={view === 'coach' ? 'active' : ''} onClick={() => setView('coach')}>Coach</button>
          </nav>
        )}

        <div className="topbar-actions">
          {demoMode && <span className="demo-live-tag">Demo data</span>}
          <div className="prototype-tag">Hackathon MVP · v0.5</div>
        </div>
      </header>

      {view === 'welcome' && (
        <>
          <section className="welcome-hero">
            <div className="welcome-copy">
              <div className="eyebrow">Movement → Ability → Opportunity</div>
              <h1>Measure ability.<br />Build the path back.</h1>
              <p>
                HIMAM uses short camera and digital tasks to translate functional performance into an
                explainable work-task profile, then identifies what to train next.
              </p>
              <div className="value-row">
                <div><strong>3</strong><span>short assessments</span></div>
                <div><strong>4</strong><span>functional domains</span></div>
                <div><strong>1</strong><span>personalized next step</span></div>
              </div>
            </div>

            <div className="welcome-visual" aria-label="HIMAM assessment flow">
              <div className="visual-orbit orbit-one" />
              <div className="visual-orbit orbit-two" />
              <div className="visual-center">
                <span>HIMAM</span>
                <strong>75</strong>
                <small>Functional Index</small>
              </div>
              <div className="visual-node node-reach"><span>Reach</span><strong>84</strong></div>
              <div className="visual-node node-hand"><span>Hand</span><strong>52</strong></div>
              <div className="visual-node node-digital"><span>Digital</span><strong>99</strong></div>
              <div className="visual-node node-work"><span>Office</span><strong>82</strong></div>
            </div>
          </section>

          <section className="goal-section">
            <div className="section-heading-row">
              <div>
                <div className="eyebrow">Step 01 · Personal goal</div>
                <h2>What do you want to get back to?</h2>
                <p className="section-copy">Choose one work-task goal. HIMAM will still show the full profile, but highlights the route most relevant to you.</p>
              </div>
              <div className="privacy-chip">Camera processing stays in-browser for this MVP</div>
            </div>

            <div className="goal-grid">
              {GOALS.map((item) => (
                <button
                  key={item.id}
                  className={`goal-card ${goal === item.id ? 'selected' : ''}`}
                  onClick={() => setGoal(item.id)}
                >
                  <span className="goal-number">{item.number}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.subtitle}</p>
                  </div>
                  <span className="goal-check">{goal === item.id ? '✓' : '→'}</span>
                </button>
              ))}
            </div>

            <div className="welcome-actions">
              <button className="primary-btn large-btn" disabled={!goal} onClick={startLiveAssessment}>
                Start live assessment →
              </button>
              <div className="demo-option">
                <button className="secondary-btn large-btn" onClick={launchDemo}>Launch judge-safe demo</button>
                <span>No camera required · loads a complete sample pathway</span>
              </div>
            </div>
          </section>

          <section className="how-it-works">
            <div className="eyebrow">The HIMAM pathway</div>
            <div className="pathway-grid">
              <article><span>01</span><strong>Measure</strong><p>Pose, hand and digital task signals.</p></article>
              <article><span>02</span><strong>Understand</strong><p>Four transparent functional domains.</p></article>
              <article><span>03</span><strong>Map</strong><p>Explainable work-task requirement weights.</p></article>
              <article><span>04</span><strong>Train</strong><p>Adapt difficulty to the person, then reassess.</p></article>
            </div>
          </section>
        </>
      )}

      {view === 'assessment' && (
        <>
          <section className="compact-hero">
            <div>
              <div className="eyebrow">Live assessment · {selectedGoal.title}</div>
              <h1>Your functional profile starts here.</h1>
              <p>Three short tasks. No opaque prediction: every score is built from visible task-performance metrics.</p>
            </div>
            <div className="compact-hero-actions">
              <button className="secondary-btn" onClick={launchDemo}>Use backup demo</button>
              <div className="completion-ring"><strong>{completedTests}/3</strong><span>complete</span></div>
            </div>
          </section>

          <section className="test-switcher three-tests" aria-label="Assessment navigation">
            <button className={activeTest === 'reach' ? 'active' : ''} onClick={() => setActiveTest('reach')}>
              <span>{reachResult ? '✓' : '01'}</span>
              <div>
                <strong>Reach & Target</strong>
                <small>{reachResult ? `${reachResult.reachScore}/100 complete` : 'Camera + pose'}</small>
              </div>
            </button>
            <button className={activeTest === 'hand' ? 'active' : ''} onClick={() => setActiveTest('hand')}>
              <span>{handResult ? '✓' : '02'}</span>
              <div>
                <strong>Pinch & Transfer</strong>
                <small>{handResult ? `${handResult.handControlScore}/100 complete` : 'Camera + hand landmarks'}</small>
              </div>
            </button>
            <button className={activeTest === 'digital' ? 'active' : ''} onClick={() => setActiveTest('digital')}>
              <span>{digitalResult ? '✓' : '03'}</span>
              <div>
                <strong>Digital Work</strong>
                <small>{digitalResult ? `${digitalResult.digitalControlScore}/100 complete` : 'Mouse + drag + typing'}</small>
              </div>
            </button>
          </section>

          {activeTest === 'reach' && <ReachAssessment onComplete={setReachResult} />}
          {activeTest === 'hand' && <HandAssessment onComplete={setHandResult} />}
          {activeTest === 'digital' && <DigitalAssessment onComplete={setDigitalResult} />}

          <section className="assessment-nav-row">
            <div>
              <span>{completedTests}/3 assessments completed</span>
              <div className="mini-progress app-progress">
                <div style={{ width: `${(completedTests / 3) * 100}%` }} />
              </div>
            </div>
            {activeTest === 'reach' && (
              <button className="secondary-btn" onClick={() => setActiveTest('hand')}>Continue to Hand Control →</button>
            )}
            {activeTest === 'hand' && (
              <button className="secondary-btn" onClick={() => setActiveTest('digital')}>Continue to Digital Work →</button>
            )}
            {activeTest === 'digital' && !functionalProfile && (
              <button className="secondary-btn" onClick={() => setActiveTest('reach')}>← Review Reach Test</button>
            )}
            {functionalProfile && (
              <button className="primary-btn" onClick={() => setView('results')}>View final results →</button>
            )}
          </section>

          <section className="next-layer">
            <div className="section-heading-row">
              <div>
                <div className="eyebrow">Functional profile</div>
                <h2>Four interpretable domains. One readiness story.</h2>
              </div>
              {functionalProfile && <div className="profile-ready-badge">Full profile active</div>}
            </div>

            <div className="flow-cards profile-cards">
              <article className={reachResult ? '' : 'muted'}>
                <span>01</span><strong>Reach</strong><small>{reachResult ? `${reachResult.reachScore}/100` : 'Run Test 01'}</small>
              </article>
              <article className={handResult ? '' : 'muted'}>
                <span>02</span><strong>Hand Control</strong><small>{handResult ? `${handResult.handControlScore}/100` : 'Run Test 02'}</small>
              </article>
              <article className={coordinationScore != null ? '' : 'muted'}>
                <span>03</span><strong>Coordination</strong><small>{coordinationScore != null ? `${coordinationScore}/100 derived` : 'Needs Tests 01 + 02'}</small>
              </article>
              <article className={digitalResult ? '' : 'muted'}>
                <span>04</span><strong>Digital Control</strong><small>{digitalResult ? `${digitalResult.digitalControlScore}/100` : 'Run Test 03'}</small>
              </article>
            </div>

            {functionalProfile ? (
              <div className="combined-summary four-stats">
                <div>
                  <div className="eyebrow">Functional profile complete</div>
                  <h3>HIMAM keeps the domains separate, then maps them transparently to simulated work-task requirements.</h3>
                </div>
                <div className="summary-stat"><span>Reach</span><strong>{functionalProfile.reach}</strong></div>
                <div className="summary-stat"><span>Hand</span><strong>{functionalProfile.hand}</strong></div>
                <div className="summary-stat"><span>Coord.</span><strong>{functionalProfile.coordination}</strong></div>
                <div className="summary-stat"><span>Digital</span><strong>{functionalProfile.digital}</strong></div>
              </div>
            ) : (
              <div className="roadmap-strip">
                <div><span>Activation rule</span><strong>Complete Tests 01–03</strong></div>
                <p>The Work Readiness Matrix stays locked until all measured domains are available.</p>
              </div>
            )}
          </section>
        </>
      )}

      {view === 'results' && functionalProfile && (
        <>
          <section className="results-hero">
            <div className="results-hero-copy">
              <div className="eyebrow">Assessment complete · {demoMode ? 'Demonstration pathway' : 'Live pathway'}</div>
              <h1>Your ability profile is not one number.</h1>
              <p>HIMAM shows where performance is already strong, where the selected work goal stands, and the most useful training target to address next.</p>
              <div className="results-actions">
                <button className="primary-btn" onClick={() => setView('coach')}>Open coach dashboard →</button>
                <button className="secondary-btn" onClick={() => setView('assessment')}>Review assessments</button>
              </div>
            </div>
            <div className="index-card">
              <span>Functional Index</span>
              <strong>{functionalIndex}</strong>
              <small>Prototype summary of four task domains</small>
              <div className="index-track"><div style={{ width: `${functionalIndex ?? 0}%` }} /></div>
            </div>
          </section>

          <section className="result-dashboard-grid">
            <article className="goal-result-card">
              <div className="card-kicker">Your selected goal</div>
              <h3>{selectedGoal.title}</h3>
              {selectedReadiness && (
                <>
                  <div className="goal-score-row"><strong>{selectedReadiness.score}</strong><span>/100</span></div>
                  <div className="readiness-bar hero-readiness"><div style={{ width: `${selectedReadiness.score}%` }} /></div>
                  <p>{selectedReadiness.level}</p>
                </>
              )}
              <small>This is a prototype task-performance indicator, not a fitness-for-work decision.</small>
            </article>

            <article className="domain-panel">
              <div className="card-kicker">Functional domains</div>
              {([
                ['Reach', functionalProfile.reach],
                ['Hand Control', functionalProfile.hand],
                ['Coordination', functionalProfile.coordination],
                ['Digital Control', functionalProfile.digital],
              ] as Array<[string, number]>).map(([label, value]) => (
                <div className="domain-row" key={label}>
                  <span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value}</strong>
                </div>
              ))}
            </article>

            <article className="next-step-card">
              <div className="card-kicker">Recommended next step</div>
              <span className="priority-label">Priority domain</span>
              <h3>{training?.label}</h3>
              <p>{training?.module}</p>
              <div className="priority-score"><span>Current score</span><strong>{training?.score}</strong></div>
              <button className="primary-btn light-btn" onClick={openTrainingModule}>Start adaptive training →</button>
            </article>
          </section>

          <section className="readiness-section results-readiness">
            <div className="section-heading-row">
              <div>
                <div className="eyebrow">Motor-to-work layer</div>
                <h2>Explainable Work Readiness Matrix</h2>
                <p className="section-copy">Each work-task score is a transparent weighted combination of the four functional domains.</p>
              </div>
              <div className="matrix-status active">Prototype matrix active</div>
            </div>

            <div className="readiness-grid">
              {readiness.map((item) => (
                <article className={`readiness-card ${item.id === selectedGoal.readinessId ? 'goal-highlight' : ''}`} key={item.id}>
                  <div className="readiness-topline">
                    <span>{item.label}</span>
                    <strong>{item.score}</strong>
                  </div>
                  <div className="readiness-bar"><div style={{ width: `${item.score}%` }} /></div>
                  <small>{item.level}</small>
                  <div className="weight-row">
                    <span>R {Math.round(item.weights.reach * 100)}%</span>
                    <span>H {Math.round(item.weights.hand * 100)}%</span>
                    <span>C {Math.round(item.weights.coordination * 100)}%</span>
                    <span>D {Math.round(item.weights.digital * 100)}%</span>
                  </div>
                  {item.id === selectedGoal.readinessId && <div className="selected-goal-chip">Selected goal</div>}
                </article>
              ))}
            </div>
          </section>

          <section className="progress-section">
            <div>
              <div className="eyebrow">Progress history</div>
              <h2>Make improvement visible.</h2>
              <p className="section-copy">The demo shows how longitudinal sessions can turn isolated assessments into a measurable training journey.</p>
            </div>
            <div className="progress-card">
              <div className="progress-header"><span>Functional Index</span><strong>+{progressHistory[3] - progressHistory[0]} pts</strong></div>
              <div className="history-bars">
                {progressHistory.map((value, index) => (
                  <div className="history-column" key={`${value}-${index}`}>
                    <div className="history-bar-wrap"><div style={{ height: `${value}%` }}><span>{value}</span></div></div>
                    <small>{index === 0 ? 'Baseline' : `Session ${index + 1}`}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="validation-note result-validation">
            <strong>Validation boundary</strong>
            <p>
              HIMAM v0.5 produces task-performance indicators and adaptive training-session metrics inside a hackathon prototype. The current matrix weights and thresholds require future validation with occupational therapists, vocational rehabilitation experts, employers, and real-user data before real-world work-readiness use.
            </p>
          </div>
        </>
      )}

      {view === 'training' && functionalProfile && training && (
        <AdaptivePrecisionTraining
          initialDomainScore={training.score}
          focusLabel={training.label}
          moduleName={training.key === 'hand' ? 'Precision Transfer' : training.key === 'coordination' ? 'Guided Coordination Transfer' : training.key === 'reach' ? 'Guided Reach Transfer' : 'Digital Precision Transfer'}
          onComplete={(session) => setTrainingSessions((current) => [session, ...current])}
          onReassess={reassessPriorityDomain}
          onBack={() => setView('results')}
        />
      )}

      {view === 'coach' && functionalProfile && (
        <>
          <section className="coach-hero">
            <div>
              <div className="eyebrow">Coach dashboard · longitudinal view</div>
              <h1>See the person behind the score.</h1>
              <p>A compact supervisor view for following performance, training adherence and the next recommended focus.</p>
            </div>
            <div className="coach-person">
              <div className="avatar">AR</div>
              <div><strong>{demoMode ? 'Demo participant' : 'Current participant'}</strong><span>Upper-limb return-to-work pathway</span></div>
            </div>
          </section>

          <section className="coach-stat-grid">
            <article><span>Functional Index</span><strong>{functionalIndex}</strong><small>+{progressHistory[3] - progressHistory[0]} points from baseline</small></article>
            <article><span>Sessions completed</span><strong>{(demoMode ? 8 : completedTests) + trainingSessions.length}</strong><small>{trainingSessions.length ? `${trainingSessions.length} adaptive training session${trainingSessions.length === 1 ? '' : 's'} added` : demoMode ? 'Across 4 weeks' : 'Current assessment set'}</small></article>
            <article><span>Strongest domain</span><strong>{functionalProfile.digital}</strong><small>Digital Control</small></article>
            <article><span>Priority domain</span><strong>{training?.score}</strong><small>{training?.label}</small></article>
          </section>

          <section className="coach-main-grid">
            <article className="coach-panel">
              <div className="panel-heading"><div><span>Performance trend</span><strong>Functional domains</strong></div><small>Current</small></div>
              <div className="coach-domain-list">
                {([
                  ['Reach', functionalProfile.reach, '+11'],
                  ['Hand Control', functionalProfile.hand, '+7'],
                  ['Coordination', functionalProfile.coordination, '+9'],
                  ['Digital Control', functionalProfile.digital, '+4'],
                ] as Array<[string, number, string]>).map(([label, value, delta]) => (
                  <div className="coach-domain-row" key={label}>
                    <div><strong>{label}</strong><span>{delta} pts</span></div>
                    <div className="coach-progress"><i style={{ width: `${value}%` }} /></div>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className="coach-panel focus-panel">
              <div className="panel-heading"><div><span>Next focus</span><strong>{training?.label}</strong></div><small>Priority</small></div>
              <div className="focus-score"><strong>{training?.score}</strong><span>/100</span></div>
              <p>Recommended module: <b>{training?.module}</b>. Reassess after two successful training sessions to update the functional profile.</p>
              <button className="primary-btn" onClick={openTrainingModule}>Open adaptive module →</button>
            </article>
          </section>

          <section className="coach-main-grid lower-coach-grid">
            <article className="coach-panel">
              <div className="panel-heading"><div><span>Recent activity</span><strong>Session timeline</strong></div><small>Last 4</small></div>
              <div className="timeline-list">
                <div><span>Today</span><strong>Full functional reassessment</strong><small>Index {functionalIndex}</small></div>
                {trainingSessions[0] ? (
                  <div><span>Training</span><strong>{trainingSessions[0].module}</strong><small>Avg {trainingSessions[0].averageScore} · L{trainingSessions[0].startingLevel}→L{trainingSessions[0].finalLevel}</small></div>
                ) : (
                  <div><span>Week 3</span><strong>Precision Transfer · Level 1</strong><small>Completed</small></div>
                )}
                <div><span>Week 2</span><strong>Guided Coordination · Level 1</strong><small>Completed</small></div>
                <div><span>Baseline</span><strong>Initial functional profile</strong><small>Index {progressHistory[0]}</small></div>
              </div>
            </article>

            <article className="coach-panel">
              <div className="panel-heading"><div><span>Work-task snapshot</span><strong>{selectedGoal.title}</strong></div><small>Selected goal</small></div>
              <div className="coach-readiness-score"><strong>{selectedReadiness?.score}</strong><span>{selectedReadiness?.level}</span></div>
              <div className="readiness-bar"><div style={{ width: `${selectedReadiness?.score ?? 0}%` }} /></div>
              <p className="coach-note">Use as a conversation aid for training planning, not as an employment clearance or clinical diagnosis.</p>
            </article>
          </section>
        </>
      )}

      {view !== 'welcome' && (
        <footer className="app-footer">
          <div><strong>هِمَم · HIMAM</strong><span>Hackathon prototype · Task-performance indicators only</span></div>
          <button className="text-reset" onClick={resetAssessment}>Reset prototype</button>
        </footer>
      )}
    </main>
  );
}

export default App;
