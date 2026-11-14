import { usePractice } from '../lib/PracticeContext';
import { GOAL_OPTIONS } from '../lib/practice';
import { useI18n } from '../i18n';
import { WeekGrid } from './WeekGrid';

export function PracticePlan() {
  const { stats, state, notifPermission, setWeeklyGoal, setReminderEnabled, setReminderTime, requestNotifications, downloadCalendar } = usePractice();
  const { language } = useI18n();
  const ar = language === 'ar';
  const percentage = Math.min(100, Math.round(stats.weekDone / stats.weeklyGoal * 100));
  return (
    <section className="home-practice-plan">
      <div className="practice-plan-title">
        <div>
          <span className="eyebrow">{ar ? 'بناء عادة مستمرة' : 'BUILD A ROUTINE'}</span>
          <h2>{ar ? 'خطة التدريب المنزلي' : 'Home practice plan'}</h2>
          <p>{ar ? 'كل يوم تدريب يحسب مرة واحدة ضمن هدفك الأسبوعي.' : 'Each day of practice counts once toward your weekly goal.'}</p>
        </div>
        <div className="practice-goal-ring" style={{ background: 'conic-gradient(#37bea8 ' + percentage + '%, #dce9ef 0)' }}>
          <div><strong>{stats.weekDone}/{stats.weeklyGoal}</strong><small>{ar ? 'أيام' : 'days'}</small></div>
        </div>
      </div>
      <div className="practice-plan-layout">
        <div className="practice-plan-panel">
          <div className="practice-mini-stats">
            <div><strong>{stats.currentStreak}</strong><span>{ar ? 'التتابع الحالي' : 'Current streak'}</span></div>
            <div><strong>{stats.bestStreak}</strong><span>{ar ? 'أفضل تتابع' : 'Best streak'}</span></div>
            <div><strong>{stats.totalDays}</strong><span>{ar ? 'أيام تدريب' : 'Practice days'}</span></div>
          </div>
          <label className="practice-form-label" htmlFor="weekly-goal">{ar ? 'الهدف الأسبوعي' : 'Weekly goal'}</label>
          <select id="weekly-goal" value={state.weeklyGoal} onChange={(event) => setWeeklyGoal(Number(event.target.value))}>
            {GOAL_OPTIONS.map((goal) => <option key={goal} value={goal}>{goal} {ar ? 'أيام' : 'days'}</option>)}
          </select>
          <label className="practice-reminder-toggle">
            <input type="checkbox" checked={state.reminder.enabled} onChange={(event) => setReminderEnabled(event.target.checked)} />
            {ar ? 'تفعيل التذكير اليومي' : 'Enable daily reminder'}
          </label>
          {state.reminder.enabled && (
            <div className="practice-reminder-controls">
              <input type="time" aria-label={ar ? 'وقت التذكير' : 'Reminder time'} value={state.reminder.time} onChange={(event) => setReminderTime(event.target.value)} />
              {notifPermission !== 'granted' && (
                <button type="button" className="secondary-btn" onClick={requestNotifications}>
                  {ar ? 'تفعيل إشعارات المتصفح' : 'Enable browser notifications'}
                </button>
              )}
              <button type="button" className="secondary-btn" onClick={downloadCalendar}>{ar ? 'إضافة إلى التقويم' : 'Add calendar reminder'}</button>
            </div>
          )}
        </div>
        <div className="practice-plan-panel">
          <h3>{ar ? 'آخر 4 أسابيع' : 'Last 4 weeks'}</h3>
          <WeekGrid weeks={stats.weeks} />
          <p className="practice-note">{ar ? 'تُحفظ بيانات التدريب في هذا المتصفح فقط.' : 'Your practice record is stored in this browser only.'}</p>
        </div>
      </div>
    </section>
  );
}
