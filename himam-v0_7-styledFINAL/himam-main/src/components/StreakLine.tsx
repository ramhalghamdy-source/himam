import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { usePractice } from '../lib/PracticeContext';
import { BellIcon, CheckIcon, FlameIcon } from './Icons';
import { PracticeSettings } from './PracticeSettings';

type Props = {
  /** whether a functional profile exists yet (training needs one) */
  hasProfile: boolean;
  onPractice: () => void;
};

/**
 * The streak lives in one slim line directly under the header — visible the moment the
 * app opens, no card, no box. Flame + count · this week's 7 days · weekly-goal line ·
 * status + one action · reminder.
 */
export function StreakLine({ hasProfile, onPractice }: Props) {
  const { t, tp, locale } = useI18n();
  const { stats, state, reminderDue } = usePractice();
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  const narrow = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }), [locale]);
  const long = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' }), [locale]);
  const timeLabel = useMemo(() => {
    const [h, m] = state.reminder.time.split(':').map(Number);
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, h, m));
  }, [locale, state.reminder.time]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const alive = stats.currentStreak > 0;
  const due = reminderDue && !stats.todayDone;
  const status = stats.todayDone
    ? t('streak.todayDone')
    : due
      ? t('streak.reminderDue')
      : stats.atRisk
        ? t('streak.keepAlive')
        : t('streak.first');
  const goalRatio = Math.min(100, Math.round((stats.weekDone / stats.weeklyGoal) * 100));

  return (
    <section className={`streak-line ${alive ? 'alive' : ''} ${due ? 'due' : ''}`} aria-label={t('streak.label')}>
      <div className="streak-main">
        <FlameIcon size={26} active={alive} />
        <div>
          <span className="streak-kicker">
            {t('streak.label')}
            {state.demo && <em>{t('streak.demoTag')}</em>}
          </span>
          <strong>{tp('streak.count', stats.currentStreak)}</strong>
        </div>
      </div>

      <ol className="streak-week" aria-label={t('streak.weekAria')}>
        {stats.weekCells.map((c) => (
          <li
            key={c.key}
            title={long.format(c.date)}
            className={[c.done ? 'done' : c.isFuture ? 'future' : 'missed', c.isToday ? 'today' : ''].join(' ').trim()}
          >
            <span>{narrow.format(c.date)}</span>
            <i>{c.done && <CheckIcon size={10} />}</i>
          </li>
        ))}
      </ol>

      <div className="streak-goal">
        <span>{t('streak.weekGoal', { done: stats.weekDone, goal: stats.weeklyGoal })}</span>
        <div className="streak-goal-track" aria-hidden="true">
          <div style={{ width: `${goalRatio}%` }} />
        </div>
      </div>

      <div className="streak-status">
        <span className={`streak-status-text ${stats.todayDone ? 'ok' : due ? 'due' : ''}`} aria-live="polite">
          {stats.todayDone && <CheckIcon size={12} />} {status}
        </span>
        {!stats.todayDone && (
          <button type="button" className="streak-cta" onClick={onPractice}>
            {hasProfile ? t('streak.cta.practice') : t('streak.cta.start')}
          </button>
        )}
      </div>

      <div className="streak-reminder" ref={popRef}>
        <button
          type="button"
          className={`streak-reminder-btn ${state.reminder.enabled ? 'on' : ''}`}
          aria-expanded={open}
          aria-controls={popId}
          onClick={() => setOpen((value) => !value)}
        >
          <BellIcon />
          <span>{state.reminder.enabled ? t('streak.reminderOn', { time: timeLabel }) : t('streak.reminderSet')}</span>
        </button>
        {open && (
          <div className="streak-popover" id={popId} role="dialog" aria-label={t('pp.reminder.title')}>
            <PracticeSettings idPrefix="line" />
          </div>
        )}
      </div>
    </section>
  );
}
