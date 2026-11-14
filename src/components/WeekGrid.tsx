import type { DayCell } from '../lib/practice';
import { useI18n } from '../i18n';

type Props = { weeks: DayCell[][] };

export function WeekGrid({ weeks }: Props) {
  const { language } = useI18n();
  const labels = language === 'ar' ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div className="practice-week-grid" aria-label={language === 'ar' ? 'سجل تدريب آخر أربعة أسابيع' : 'Last four weeks of practice'}>
      <div className="practice-week-row practice-days-head">
        {labels.map((label, i) => <span key={i}>{label}</span>)}
      </div>
      {weeks.map((week, i) => (
        <div className="practice-week-row" key={i}>
          {week.map((cell) => (
            <span key={cell.key} className={'practice-day ' + (cell.done ? 'done ' : '') + (cell.isToday ? 'today ' : '') + (cell.isFuture ? 'future' : '')}
              title={cell.date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') + (cell.done ? (language === 'ar' ? ' · تم التدريب' : ' · practiced') : '')}
              aria-label={cell.key + (cell.done ? ' practiced' : '')} />
          ))}
        </div>
      ))}
    </div>
  );
}
