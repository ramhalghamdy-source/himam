import { useEffect, useMemo, useRef, useState } from 'react';
import { ReachAssessment } from './components/ReachAssessment';
import { HandAssessment } from './components/HandAssessment';
import { DigitalAssessment } from './components/DigitalAssessment';
import { AdaptivePrecisionTraining } from './components/AdaptivePrecisionTraining';
import { LanguageToggle } from './components/LanguageToggle';
import { StreakLine } from './components/StreakLine';
import { PracticePlan } from './components/PracticePlan';
import { WeekGrid } from './components/WeekGrid';
import { useI18n } from './i18n';
import type { TKey } from './i18n/translations';
import { usePractice } from './lib/PracticeContext';
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
  readinessId: 'office' | 'sorting' | 'assembly';
}> = [
  { id: 'office', number: '01', readinessId: 'office' },
  { id: 'sorting', number: '02', readinessId: 'sorting' },
  { id: 'manual', number: '03', readinessId: 'assembly' },
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
  const { t, tp } = useI18n();
  const { stats, state: practiceState, logSession, seedDemo, resetHistory } = usePractice();
  const [view, setView] = useState<AppView>('welcome');
  const [activeTest, setActiveTest] = useState<ActiveTest>('reach');
  const [goal, setGoal] = useState<WorkGoal | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [reachResult, setReachResult] = useState<ReachMetrics | null>(null);
  const [handResult, setHandResult] = useState<HandMetrics | null>(null);
  const [digitalResult, setDigitalResult] = useState<DigitalMetrics | null>(null);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSessionResult[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastPending = useRef(false);

  // After a training session is saved, celebrate the new streak / weekly goal for a few seconds.
  useEffect(() => {
    if (!toastPending.current) return;
    toastPending.current = false;
    const text = stats.goalReached && stats.weekDone === stats.weeklyGoal
      ? t('pp.earned.goal')
      : t('pp.earned.streak', { streak: tp('streak.count', stats.currentStreak) });
    setToast(text);
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.totalSessions]);

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
  const selectedGoalTitle = t(`goal.${selectedGoal.id}.title` as TKey);
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
    seedDemo();
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
    if (practiceState.demo) resetHistory();
    setView('welcome');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function practiceNow() {
    if (functionalProfile) {
      openTrainingModule();
    } else {
      setView('welcome');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        <button className="brand-button" onClick={() => setView('welcome')} aria-label={t('brand.homeAria')}>
          <span className="brand-placeholder" aria-hidden="true">هـ</span>
          <div className="brand-copy">
            <strong>هِمَم · HIMAM</strong>
            <span>{t('brand.tagline')}</span>
          </div>
        </button>

        {view !== 'welcome' && (
          <nav className="app-nav" aria-label={t('nav.aria')}>
            <button className={view === 'assessment' ? 'active' : ''} onClick={() => setView('assessment')}>{t('nav.assessment')}</button>
            <button disabled={!functionalProfile} className={view === 'results' ? 'active' : ''} onClick={() => setView('results')}>{t('nav.results')}</button>
            <button disabled={!functionalProfile} className={view === 'training' ? 'active' : ''} onClick={() => setView('training')}>{t('nav.training')}</button>
            <button disabled={!functionalProfile} className={view === 'coach' ? 'active' : ''} onClick={() => setView('coach')}>{t('nav.coach')}</button>
          </nav>
        )}

        <div className="topbar-actions">
          {demoMode && <span className="demo-live-tag">{t('tag.demo')}</span>}
          <div className="prototype-tag">{t('tag.proto')}</div>
          <LanguageToggle />
        </div>
      </header>

      <StreakLine hasProfile={Boolean(functionalProfile)} onPractice={practiceNow} />

      {view === 'welcome' && (
        <>
          <section className="welcome-hero">
            <div className="welcome-copy">
              <div className="eyebrow">{t('welcome.eyebrow')}</div>
              <h1>{t('welcome.h1a')}<br />{t('welcome.h1b')}</h1>
              <p>{t('welcome.p')}</p>
              <div className="value-row">
                <div><strong>3</strong><span>{t('welcome.value.assessments')}</span></div>
                <div><strong>4</strong><span>{t('welcome.value.domains')}</span></div>
                <div><strong>1</strong><span>{t('welcome.value.step')}</span></div>
              </div>
            </div>

            <div className="welcome-visual" aria-label={t('welcome.visual.aria')}>
              <div className="visual-orbit orbit-one" />
              <div className="visual-orbit orbit-two" />
              <div className="visual-center">
                <span>HIMAM</span>
                <strong>75</strong>
                <small>{t('welcome.visual.center')}</small>
              </div>
              <div className="visual-node node-reach"><span>{t('welcome.node.reach')}</span><strong>84</strong></div>
              <div className="visual-node node-hand"><span>{t('welcome.node.hand')}</span><strong>52</strong></div>
              <div className="visual-node node-digital"><span>{t('welcome.node.digital')}</span><strong>99</strong></div>
              <div className="visual-node node-work"><span>{t('welcome.node.work')}</span><strong>82</strong></div>
            </div>
          </section>

          <section className="goal-section">
            <div className="section-heading-row">
              <div>
                <div className="eyebrow">{t('goal.eyebrow')}</div>
                <h2>{t('goal.title')}</h2>
                <p className="section-copy">{t('goal.copy')}</p>
              </div>
              <div className="privacy-chip">{t('goal.privacy')}</div>
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
                    <strong>{t(`goal.${item.id}.title` as TKey)}</strong>
                    <p>{t(`goal.${item.id}.sub` as TKey)}</p>
                  </div>
                  <span className="goal-check">{goal === item.id ? '✓' : '→'}</span>
                </button>
              ))}
            </div>

            <div className="welcome-actions">
              <button className="primary-btn large-btn" disabled={!goal} onClick={startLiveAssessment}>
                {t('welcome.startLive')}
              </button>
              <div className="demo-option">
                <button className="secondary-btn large-btn" onClick={launchDemo}>{t('welcome.demoBtn')}</button>
                <span>{t('welcome.demoNote')}</span>
              </div>
            </div>
          </section>

          <section className="how-it-works">
            <div className="eyebrow">{t('pathway.eyebrow')}</div>
            <div className="pathway-grid">
              <article><span>01</span><strong>{t('pathway.measure')}</strong><p>{t('pathway.measure.d')}</p></article>
              <article><span>02</span><strong>{t('pathway.understand')}</strong><p>{t('pathway.understand.d')}</p></article>
              <article><span>03</span><strong>{t('pathway.map')}</strong><p>{t('pathway.map.d')}</p></article>
              <article><span>04</span><strong>{t('pathway.train')}</strong><p>{t('pathway.train.d')}</p></article>
            </div>
          </section>
        </>
      )}

      {view === 'assessment' && (
        <>
          <section className="compact-hero">
            <div>
              <div className="eyebrow">{t('assess.eyebrow', { goal: selectedGoalTitle })}</div>
              <h1>{t('assess.title')}</h1>
              <p>{t('assess.p')}</p>
            </div>
            <div className="compact-hero-actions">
              <button className="secondary-btn" onClick={launchDemo}>{t('assess.backupDemo')}</button>
              <div className="completion-ring"><strong>{completedTests}/3</strong><span>{t('assess.complete')}</span></div>
            </div>
          </section>

          <section className="test-switcher three-tests" aria-label={t('assess.title')}>
            <button className={activeTest === 'reach' ? 'active' : ''} onClick={() => setActiveTest('reach')}>
              <span>{reachResult ? '✓' : '01'}</span>
              <div>
                <strong>{t('test.reach.title')}</strong>
                <small>{reachResult ? t('test.done', { score: reachResult.reachScore }) : t('test.reach.sub')}</small>
              </div>
            </button>
            <button className={activeTest === 'hand' ? 'active' : ''} onClick={() => setActiveTest('hand')}>
              <span>{handResult ? '✓' : '02'}</span>
              <div>
                <strong>{t('test.hand.title')}</strong>
                <small>{handResult ? t('test.done', { score: handResult.handControlScore }) : t('test.hand.sub')}</small>
              </div>
            </button>
            <button className={activeTest === 'digital' ? 'active' : ''} onClick={() => setActiveTest('digital')}>
              <span>{digitalResult ? '✓' : '03'}</span>
              <div>
                <strong>{t('test.digital.title')}</strong>
                <small>{digitalResult ? t('test.done', { score: digitalResult.digitalControlScore }) : t('test.digital.sub')}</small>
              </div>
            </button>
          </section>

          {activeTest === 'reach' && <ReachAssessment onComplete={setReachResult} />}
          {activeTest === 'hand' && <HandAssessment onComplete={setHandResult} />}
          {activeTest === 'digital' && <DigitalAssessment onComplete={setDigitalResult} />}

          <section className="assessment-nav-row">
            <div>
              <span>{t('assess.countDone', { n: completedTests })}</span>
              <div className="mini-progress app-progress">
                <div style={{ width: `${(completedTests / 3) * 100}%` }} />
              </div>
            </div>
            {activeTest === 'reach' && (
              <button className="secondary-btn" onClick={() => setActiveTest('hand')}>{t('assess.toHand')}</button>
            )}
            {activeTest === 'hand' && (
              <button className="secondary-btn" onClick={() => setActiveTest('digital')}>{t('assess.toDigital')}</button>
            )}
            {activeTest === 'digital' && !functionalProfile && (
              <button className="secondary-btn" onClick={() => setActiveTest('reach')}>{t('assess.backReach')}</button>
            )}
            {functionalProfile && (
              <button className="primary-btn" onClick={() => setView('results')}>{t('assess.viewResults')}</button>
            )}
          </section>

          <section className="next-layer">
            <div className="section-heading-row">
              <div>
                <div className="eyebrow">{t('results.domainsKicker')}</div>
                <h2>{t('profile.title')}</h2>
              </div>
              {functionalProfile && <div className="profile-ready-badge">{t('profile.badge')}</div>}
            </div>

            <div className="flow-cards profile-cards">
              <article className={reachResult ? '' : 'muted'}>
                <span>01</span><strong>{t('domainShort.reach')}</strong><small>{reachResult ? `${reachResult.reachScore}/100` : t('profile.run1')}</small>
              </article>
              <article className={handResult ? '' : 'muted'}>
                <span>02</span><strong>{t('domainShort.hand')}</strong><small>{handResult ? `${handResult.handControlScore}/100` : t('profile.run2')}</small>
              </article>
              <article className={coordinationScore != null ? '' : 'muted'}>
                <span>03</span><strong>{t('domainShort.coordination')}</strong><small>{coordinationScore != null ? t('profile.derived', { n: coordinationScore }) : t('profile.needs12')}</small>
              </article>
              <article className={digitalResult ? '' : 'muted'}>
                <span>04</span><strong>{t('domainShort.digital')}</strong><small>{digitalResult ? `${digitalResult.digitalControlScore}/100` : t('profile.run3')}</small>
              </article>
            </div>

            {functionalProfile ? (
              <div className="combined-summary four-stats">
                <div>
                  <div className="eyebrow">{t('profile.completeEyebrow')}</div>
                  <h3>{t('profile.completeText')}</h3>
                </div>
                <div className="summary-stat"><span>{t('domainShort.reach')}</span><strong>{functionalProfile.reach}</strong></div>
                <div className="summary-stat"><span>{t('welcome.node.hand')}</span><strong>{functionalProfile.hand}</strong></div>
                <div className="summary-stat"><span>{t('profile.coordShort')}</span><strong>{functionalProfile.coordination}</strong></div>
                <div className="summary-stat"><span>{t('welcome.node.digital')}</span><strong>{functionalProfile.digital}</strong></div>
              </div>
            ) : (
              <div className="roadmap-strip">
                <div><span>{t('profile.lockRule')}</span><strong>{t('profile.lockTitle')}</strong></div>
                <p>{t('profile.lockText')}</p>
              </div>
            )}
          </section>
        </>
      )}

      {view === 'results' && functionalProfile && (
        <>
          <section className="results-hero">
            <div className="results-hero-copy">
              <div className="eyebrow">{t('results.eyebrow', { mode: demoMode ? t('results.modeDemo') : t('results.modeLive') })}</div>
              <h1>{t('results.title')}</h1>
              <p>{t('results.p')}</p>
              <div className="results-actions">
                <button className="primary-btn" onClick={() => setView('coach')}>{t('results.openCoach')}</button>
                <button className="secondary-btn" onClick={() => setView('assessment')}>{t('results.review')}</button>
              </div>
            </div>
            <div className="index-card">
              <span>{t('results.indexLabel')}</span>
              <strong>{functionalIndex}</strong>
              <small>{t('results.indexSub')}</small>
              <div className="index-track"><div style={{ width: `${functionalIndex ?? 0}%` }} /></div>
            </div>
          </section>

          <section className="result-dashboard-grid">
            <article className="goal-result-card">
              <div className="card-kicker">{t('results.goalKicker')}</div>
              <h3>{selectedGoalTitle}</h3>
              {selectedReadiness && (
                <>
                  <div className="goal-score-row"><strong>{selectedReadiness.score}</strong><span>/100</span></div>
                  <div className="readiness-bar hero-readiness"><div style={{ width: `${selectedReadiness.score}%` }} /></div>
                  <p>{t(`level.${selectedReadiness.level}` as TKey)}</p>
                </>
              )}
              <small>{t('results.goalNote')}</small>
            </article>

            <article className="domain-panel">
              <div className="card-kicker">{t('results.domainsKicker')}</div>
              {([
                [t('domainShort.reach'), functionalProfile.reach],
                [t('domainShort.hand'), functionalProfile.hand],
                [t('domainShort.coordination'), functionalProfile.coordination],
                [t('domainShort.digital'), functionalProfile.digital],
              ] as Array<[string, number]>).map(([label, value]) => (
                <div className="domain-row" key={label}>
                  <span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{value}</strong>
                </div>
              ))}
            </article>

            <article className="next-step-card">
              <div className="card-kicker">{t('results.nextKicker')}</div>
              <span className="priority-label">{t('results.priority')}</span>
              <h3>{training && t(`domain.${training.key}` as TKey)}</h3>
              <p>{training && t(`module.${training.key}` as TKey)}</p>
              <div className="priority-score"><span>{t('results.currentScore')}</span><strong>{training?.score}</strong></div>
              <button className="primary-btn light-btn" onClick={openTrainingModule}>{t('results.startTraining')}</button>
            </article>
          </section>

          <section className="readiness-section results-readiness">
            <div className="section-heading-row">
              <div>
                <div className="eyebrow">{t('matrix.eyebrow')}</div>
                <h2>{t('matrix.title')}</h2>
                <p className="section-copy">{t('matrix.copy')}</p>
              </div>
              <div className="matrix-status active">{t('matrix.status')}</div>
            </div>

            <div className="readiness-grid">
              {readiness.map((item) => (
                <article className={`readiness-card ${item.id === selectedGoal.readinessId ? 'goal-highlight' : ''}`} key={item.id}>
                  <div className="readiness-topline">
                    <span>{t(`readiness.${item.id}` as TKey)}</span>
                    <strong>{item.score}</strong>
                  </div>
                  <div className="readiness-bar"><div style={{ width: `${item.score}%` }} /></div>
                  <small>{t(`level.${item.level}` as TKey)}</small>
                  <div className="weight-row">
                    <span>{t('weight.reach')} {Math.round(item.weights.reach * 100)}%</span>
                    <span>{t('weight.hand')} {Math.round(item.weights.hand * 100)}%</span>
                    <span>{t('weight.coordination')} {Math.round(item.weights.coordination * 100)}%</span>
                    <span>{t('weight.digital')} {Math.round(item.weights.digital * 100)}%</span>
                  </div>
                  {item.id === selectedGoal.readinessId && <div className="selected-goal-chip">{t('matrix.selected')}</div>}
                </article>
              ))}
            </div>
          </section>

          <section className="progress-section">
            <div>
              <div className="eyebrow">{t('history.eyebrow')}</div>
              <h2>{t('history.title')}</h2>
              <p className="section-copy">{t('history.copy')}</p>
            </div>
            <div className="progress-card">
              <div className="progress-header"><span>{t('history.indexLabel')}</span><strong>{t('history.pts', { n: progressHistory[3] - progressHistory[0] })}</strong></div>
              <div className="history-bars">
                {progressHistory.map((value, index) => (
                  <div className="history-column" key={`${value}-${index}`}>
                    <div className="history-bar-wrap"><div style={{ height: `${value}%` }}><span>{value}</span></div></div>
                    <small>{index === 0 ? t('history.baseline') : t('history.session', { n: index + 1 })}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="validation-note result-validation">
            <strong>{t('validation.title')}</strong>
            <p>{t('validation.text')}</p>
          </div>
        </>
      )}

      {view === 'training' && functionalProfile && training && (
        <>
          <AdaptivePrecisionTraining
            initialDomainScore={training.score}
            domainKey={training.key}
            onComplete={(session) => {
              setTrainingSessions((current) => [session, ...current]);
              toastPending.current = true;
              logSession();
            }}
            onReassess={reassessPriorityDomain}
            onBack={() => setView('results')}
          />
          <PracticePlan />
        </>
      )}

      {view === 'coach' && functionalProfile && (
        <>
          <section className="coach-hero">
            <div>
              <div className="eyebrow">{t('coach.eyebrow')}</div>
              <h1>{t('coach.title')}</h1>
              <p>{t('coach.p')}</p>
            </div>
            <div className="coach-person">
              <div className="avatar">{t('coach.avatar')}</div>
              <div><strong>{demoMode ? t('coach.demoPerson') : t('coach.livePerson')}</strong><span>{t('coach.pathway')}</span></div>
            </div>
          </section>

          <section className="coach-stat-grid">
            <article><span>{t('coach.stat.index')}</span><strong>{functionalIndex}</strong><small>{t('coach.stat.fromBaseline', { n: progressHistory[3] - progressHistory[0] })}</small></article>
            <article><span>{t('coach.stat.sessions')}</span><strong>{(demoMode ? 8 : completedTests) + trainingSessions.length}</strong><small>{trainingSessions.length ? t(trainingSessions.length === 1 ? 'coach.stat.sessionAdded' : 'coach.stat.sessionsAdded', { n: trainingSessions.length }) : demoMode ? t('coach.stat.weeks') : t('coach.stat.current')}</small></article>
            <article><span>{t('coach.stat.strongest')}</span><strong>{functionalProfile.digital}</strong><small>{t('domainShort.digital')}</small></article>
            <article><span>{t('coach.stat.priority')}</span><strong>{training?.score}</strong><small>{training && t(`domain.${training.key}` as TKey)}</small></article>
          </section>

          <section className="coach-main-grid">
            <article className="coach-panel">
              <div className="panel-heading"><div><span>{t('coach.trend.kicker')}</span><strong>{t('coach.trend.title')}</strong></div><small>{t('coach.trend.current')}</small></div>
              <div className="coach-domain-list">
                {([
                  [t('domainShort.reach'), functionalProfile.reach, '+11'],
                  [t('domainShort.hand'), functionalProfile.hand, '+7'],
                  [t('domainShort.coordination'), functionalProfile.coordination, '+9'],
                  [t('domainShort.digital'), functionalProfile.digital, '+4'],
                ] as Array<[string, number, string]>).map(([label, value, delta]) => (
                  <div className="coach-domain-row" key={label}>
                    <div><strong>{label}</strong><span>{t('coach.delta', { delta })}</span></div>
                    <div className="coach-progress"><i style={{ width: `${value}%` }} /></div>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className="coach-panel focus-panel">
              <div className="panel-heading"><div><span>{t('coach.focus.kicker')}</span><strong>{training && t(`domain.${training.key}` as TKey)}</strong></div><small>{t('coach.focus.badge')}</small></div>
              <div className="focus-score"><strong>{training?.score}</strong><span>/100</span></div>
              <p>{t('coach.focus.recommended')}<b>{training && t(`module.${training.key}` as TKey)}</b>{t('coach.focus.reassess')}</p>
              <button className="primary-btn" onClick={openTrainingModule}>{t('coach.focus.open')}</button>
            </article>
          </section>

          <section className="coach-main-grid lower-coach-grid">
            <article className="coach-panel">
              <div className="panel-heading"><div><span>{t('coach.activity.kicker')}</span><strong>{t('coach.activity.title')}</strong></div><small>{t('coach.activity.last4')}</small></div>
              <div className="timeline-list">
                <div><span>{t('coach.tl.today')}</span><strong>{t('coach.tl.fullReassess')}</strong><small>{t('coach.tl.index', { n: functionalIndex ?? 0 })}</small></div>
                {trainingSessions[0] ? (
                  <div><span>{t('coach.tl.training')}</span><strong>{trainingSessions[0].domainKey ? `${t(`moduleName.${trainingSessions[0].domainKey}` as TKey)} · ${t('coach.tl.adaptiveSuffix')}` : trainingSessions[0].module}</strong><small>{t('coach.tl.avgLevels', { avg: trainingSessions[0].averageScore, a: trainingSessions[0].startingLevel, b: trainingSessions[0].finalLevel })}</small></div>
                ) : (
                  <div><span>{t('coach.tl.week3')}</span><strong>{t('module.hand')}</strong><small>{t('coach.tl.completed')}</small></div>
                )}
                <div><span>{t('coach.tl.week2')}</span><strong>{t('coach.tl.guided1')}</strong><small>{t('coach.tl.completed')}</small></div>
                <div><span>{t('coach.tl.baseline')}</span><strong>{t('coach.tl.initial')}</strong><small>{t('coach.tl.index', { n: progressHistory[0] })}</small></div>
              </div>
            </article>

            <article className="coach-panel">
              <div className="panel-heading"><div><span>{t('coach.snapshot.kicker')}</span><strong>{selectedGoalTitle}</strong></div><small>{t('coach.snapshot.badge')}</small></div>
              <div className="coach-readiness-score"><strong>{selectedReadiness?.score}</strong><span>{selectedReadiness && t(`level.${selectedReadiness.level}` as TKey)}</span></div>
              <div className="readiness-bar"><div style={{ width: `${selectedReadiness?.score ?? 0}%` }} /></div>
              <p className="coach-note">{t('coach.snapshot.note')}</p>
            </article>
          </section>

          <section className="coach-adherence">
            <div className="coach-adherence-head">
              <div>
                <span className="eyebrow">{t('coach.adherence.kicker')}</span>
                <h3>{t('coach.adherence.title')}</h3>
                <p>{t('coach.adherence.note')}</p>
              </div>
              <div className="coach-adherence-rate">
                <strong>{stats.adherenceRate}%</strong>
                <span>{t('coach.adherence.rate', { n: stats.adherenceRate })}</span>
              </div>
            </div>
            <WeekGrid weeks={stats.weeks} />
          </section>
        </>
      )}

      {view !== 'welcome' && (
        <footer className="app-footer">
          <div><strong>هِمَم · HIMAM</strong><span>{t('footer.note')}</span></div>
          <button className="text-reset" onClick={resetAssessment}>{t('footer.reset')}</button>
        </footer>
      )}

      {toast && (
        <div className="earned-toast" role="status" aria-live="polite">
          <span aria-hidden="true">🔥</span> {toast}
        </div>
      )}
    </main>
  );
}

export default App;
