import { useMemo } from 'react';
import { useI18n } from '../i18n';
import type { DayCell } from '../lib/practice';
import { CheckIcon } from './Icons';

/** 4 weeks × 7 days practice grid (oldest week first). */
export function WeekGrid({ weeks }: { weeks: DayCell[][] }) {
  const { t, locale } = useI18n();
  const narrow = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }), [locale]);
  const long = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' }), [locale]);

  return (
    <div className="week-grid" role="img" aria-label={t('pp.weeks')}>
      <div className="week-grid-head" aria-hidden="true">
        {weeks[0].map((c) => (
          <span key={c.key}>{narrow.format(c.date)}</span>
        ))}
      </div>
      {weeks.map((week, index) => (
        <div className="week-grid-row" key={index}>
          {week.map((c) => (
            <i
              key={c.key}
              title={long.format(c.date)}
              className={[
                c.done ? 'done' : c.isFuture ? 'future' : 'missed',
                c.isToday ? 'today' : '',
              ].join(' ').trim()}
            >
              {c.done && <CheckIcon size={11} />}
            </i>
          ))}
        </div>
      ))}
      <div className="week-grid-legend">
        <span><i className="done" />{t('pp.legendDone')}</span>
        <span><i className="missed" />{t('pp.legendMissed')}</span>
        <span><i className="missed today" />{t('pp.legendToday')}</span>
      </div>
    </div>
  );
}
