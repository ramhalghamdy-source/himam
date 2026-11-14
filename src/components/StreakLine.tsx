import { usePractice } from '../lib/PracticeContext';
import { useI18n } from '../i18n';
import { WeekGrid } from './WeekGrid';

type Props = { hasProfile: boolean; onPractice: () => void };

export function StreakLine({ hasProfile, onPractice }: Props) {
  const { stats, state, reminderDue } = usePractice();
  const { language } = useI18n();
  const ar = language === 'ar';
  return (
    <section className="streak-line" aria-label={ar ? 'متابعة التدريب' : 'Practice progress'}>
      <span className="streak-fire" aria-hidden="true">🔥</span>
      <strong>{stats.currentStreak} {ar ? 'أيام متتالية' : stats.currentStreak === 1 ? 'day streak' : 'day streak'}</strong>
      <div className="streak-week" aria-label={ar ? 'أيام هذا الأسبوع' : 'Days this week'}>
        {stats.weekCells.map((day) => <span key={day.key}
          title={day.key}
          className={'streak-dot ' + (day.done ? 'done ' : '') + (day.isToday ? 'today' : '')} />)}
      </div>
      <span className="streak-progress">{stats.weekDone}/{stats.weeklyGoal} {ar ? 'هذا الأسبوع' : 'this week'}</span>
      {stats.goalReached && <span className="streak-achieved">{ar ? 'تم تحقيق الهدف ✓' : 'Goal reached ✓'}</span>}
      {reminderDue && <span className="streak-reminder">{ar ? 'موعد التدريب اليوم' : 'Practice reminder'}</span>}
      {state.reminder.enabled && !reminderDue && <span className="streak-reminder">{ar ? 'تذكير' : 'Reminder'} {state.reminder.time}</span>}
      <button type="button" className="streak-cta" onClick={onPractice}>{hasProfile ? (ar ? 'تدرّب الآن' : 'Practice now') : (ar ? 'ابدأ' : 'Get started')}</button>
    </section>
  );
}
