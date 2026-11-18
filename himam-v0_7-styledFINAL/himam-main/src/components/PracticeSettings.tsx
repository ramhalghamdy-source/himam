import { useI18n } from '../i18n';
import { usePractice } from '../lib/PracticeContext';
import { GOAL_OPTIONS } from '../lib/practice';
import { BellIcon } from './Icons';

/** Weekly goal + daily reminder controls. Used in the streak popover and in the practice plan. */
export function PracticeSettings({ idPrefix }: { idPrefix: string }) {
  const { t } = useI18n();
  const {
    state,
    notifPermission,
    setWeeklyGoal,
    setReminderEnabled,
    setReminderTime,
    requestNotifications,
    downloadCalendar,
  } = usePractice();

  const notifMessage =
    notifPermission === 'granted'
      ? t('pp.reminder.notifGranted')
      : notifPermission === 'denied'
        ? t('pp.reminder.notifDenied')
        : notifPermission === 'unsupported'
          ? t('pp.reminder.notifUnsupported')
          : null;

  return (
    <div className="practice-settings">
      <div className="ps-block">
        <span className="ps-label">{t('pp.goalLabel')}</span>
        <div className="ps-goal-options" role="radiogroup" aria-label={t('pp.goalLabel')}>
          {GOAL_OPTIONS.map((goal) => (
            <button
              key={goal}
              type="button"
              role="radio"
              aria-checked={state.weeklyGoal === goal}
              className={state.weeklyGoal === goal ? 'active' : ''}
              onClick={() => setWeeklyGoal(goal)}
            >
              {goal}
            </button>
          ))}
        </div>
        <small>{t('pp.daysN', { n: state.weeklyGoal })}</small>
      </div>

      <div className="ps-block">
        <span className="ps-label"><BellIcon /> {t('pp.reminder.title')}</span>
        <label className="ps-switch" htmlFor={`${idPrefix}-reminder`}>
          <input
            id={`${idPrefix}-reminder`}
            type="checkbox"
            checked={state.reminder.enabled}
            onChange={(event) => setReminderEnabled(event.target.checked)}
          />
          <span className="ps-switch-track" aria-hidden="true"><i /></span>
          <span>{t('pp.reminder.toggle')}</span>
        </label>

        <label className="ps-time" htmlFor={`${idPrefix}-time`}>
          <span>{t('pp.reminder.time')}</span>
          <input
            id={`${idPrefix}-time`}
            type="time"
            value={state.reminder.time}
            disabled={!state.reminder.enabled}
            onChange={(event) => event.target.value && setReminderTime(event.target.value)}
          />
        </label>

        <div className="ps-actions">
          {notifPermission === 'default' && (
            <button type="button" className="secondary-btn small-btn" onClick={requestNotifications}>
              {t('pp.reminder.enableNotif')}
            </button>
          )}
          <button type="button" className="secondary-btn small-btn" onClick={downloadCalendar}>
            {t('pp.reminder.ics')}
          </button>
        </div>
        {notifMessage && <small className="ps-note">{notifMessage}</small>}
        <small className="ps-note">{t('pp.reminder.note')}</small>
      </div>
    </div>
  );
}
