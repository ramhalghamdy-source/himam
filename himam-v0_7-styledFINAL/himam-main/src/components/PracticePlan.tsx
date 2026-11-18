import { useI18n } from '../i18n';
import { usePractice } from '../lib/PracticeContext';
import { PracticeSettings } from './PracticeSettings';
import { WeekGrid } from './WeekGrid';

/** Home practice plan: visual progress tracking + reminders. Lives under the training lab. */
export function PracticePlan() {
  const { t, tp } = useI18n();
  const { stats, state } = usePractice();

  const ratio = Math.min(1, stats.weekDone / stats.weeklyGoal);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const coachLine = stats.goalReached
    ? t('pp.msg.goal')
    : stats.weekDone > 0
      ? t('pp.msg.keep')
      : t('pp.msg.start');

  return (
    <section className="practice-plan" aria-labelledby="practice-plan-title">
      <div className="practice-plan-head">
        <div>
          <div className="eyebrow">{t('pp.eyebrow')}</div>
          <h2 id="practice-plan-title">{t('pp.title')}</h2>
          <p className="section-copy">{t('pp.copy')}</p>
        </div>
        {state.demo && <span className="demo-live-tag">{t('tag.demo')}</span>}
      </div>

      <div className="practice-plan-grid">
        <div className="pp-progress">
          <div className="pp-ring" aria-hidden="true">
            <svg viewBox="0 0 100 100" width="132" height="132">
              <circle cx="50" cy="50" r={radius} className="pp-ring-track" />
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="pp-ring-fill"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - ratio)}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div><strong>{stats.weekDone}</strong><span>/ {stats.weeklyGoal}</span></div>
          </div>
          <div className="pp-progress-copy">
            <span className="pp-kicker">{t('pp.thisWeek')}</span>
            <strong>{t('pp.ofGoal', { done: stats.weekDone, goal: stats.weeklyGoal })}</strong>
            <p>{coachLine}</p>
          </div>
        </div>

        <div className="pp-stats">
          <div><span>{t('pp.stat.current')}</span><strong>{tp('streak.count', stats.currentStreak)}</strong></div>
          <div><span>{t('pp.stat.best')}</span><strong>{tp('streak.count', stats.bestStreak)}</strong></div>
          <div><span>{t('pp.stat.total')}</span><strong>{stats.totalSessions}</strong></div>
        </div>

        <div className="pp-weeks">
          <span className="pp-kicker">{t('pp.weeks')}</span>
          <WeekGrid weeks={stats.weeks} />
        </div>

        <div className="pp-settings">
          <span className="pp-kicker">{t('pp.reminder.title')}</span>
          <PracticeSettings idPrefix="plan" />
        </div>
      </div>
      {state.demo && <p className="pp-demo-note">{t('pp.demoNote')}</p>}
    </section>
  );
}
