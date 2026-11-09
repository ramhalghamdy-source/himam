/**
 * Home-practice motivation logic: streaks, weekly goal, 4-week consistency grid
 * and a calendar (.ics) reminder.
 *
 * Everything is measured in distinct PRACTICE DAYS (local time), because the
 * goal is a daily habit, not raw session volume.
 */

export type ReminderSettings = {
  enabled: boolean;
  /** 24h "HH:MM" local time */
  time: string;
};

export type PracticeState = {
  /** local date key (YYYY-MM-DD) → number of training sessions that day */
  days: Record<string, number>;
  /** practice days per week the person is aiming for */
  weeklyGoal: number;
  reminder: ReminderSettings;
  /** date key of the last browser notification, so we notify once a day */
  lastNotified: string | null;
  /** true when the history was seeded by the demo pathway */
  demo: boolean;
};

export const GOAL_OPTIONS = [3, 4, 5, 7] as const;

export const DEFAULT_STATE: PracticeState = {
  days: {},
  weeklyGoal: 3,
  reminder: { enabled: false, time: '19:00' },
  lastNotified: null,
  demo: false,
};

const STORAGE_KEY = 'himam.practice.v1';

export function loadState(): PracticeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PracticeState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      reminder: { ...DEFAULT_STATE.reminder, ...(parsed.reminder ?? {}) },
      days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveState(state: PracticeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be blocked (private mode); the app still works in memory */
  }
}

// ── Dates ──────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + amount);
  return copy;
}

/** Weeks start on Sunday (Saudi working week). */
function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

// ── Stats ──────────────────────────────────────────────────

export type DayCell = {
  key: string;
  date: Date;
  done: boolean;
  isToday: boolean;
  isFuture: boolean;
};

export type PracticeStats = {
  currentStreak: number;
  bestStreak: number;
  totalSessions: number;
  totalDays: number;
  todayDone: boolean;
  /** streak is alive only because yesterday counted; practicing today keeps it */
  atRisk: boolean;
  weekCells: DayCell[];
  weekDone: number;
  weeklyGoal: number;
  goalReached: boolean;
  /** last four weeks, oldest first, 7 cells each */
  weeks: DayCell[][];
  /** share of weekly goal achieved across the 4 weeks (0..100) */
  adherenceRate: number;
};

function cell(date: Date, days: Record<string, number>, today: Date): DayCell {
  const key = dayKey(date);
  return {
    key,
    date,
    done: (days[key] ?? 0) > 0,
    isToday: key === dayKey(today),
    isFuture: date.getTime() > today.getTime() && key !== dayKey(today),
  };
}

export function computeStats(state: PracticeState, now: Date = new Date()): PracticeStats {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const has = (date: Date) => (state.days[dayKey(date)] ?? 0) > 0;

  // current streak: today counts if done; otherwise yesterday keeps it alive
  const todayDone = has(today);
  let cursor = todayDone ? today : addDays(today, -1);
  let currentStreak = 0;
  while (has(cursor)) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }
  const atRisk = !todayDone && currentStreak > 0;

  // best streak across all history
  const keys = Object.keys(state.days)
    .filter((key) => (state.days[key] ?? 0) > 0)
    .sort();
  let bestStreak = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const key of keys) {
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    run = previous && dayKey(addDays(previous, 1)) === key ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    previous = date;
  }

  const thisWeekStart = startOfWeek(today);
  const weekCells = Array.from({ length: 7 }, (_, i) => cell(addDays(thisWeekStart, i), state.days, today));
  const weekDone = weekCells.filter((c) => c.done).length;

  const weeks = [-3, -2, -1, 0].map((offset) =>
    Array.from({ length: 7 }, (_, i) => cell(addDays(thisWeekStart, offset * 7 + i), state.days, today)),
  );
  const perWeek = weeks.map((week) => Math.min(1, week.filter((c) => c.done).length / state.weeklyGoal));
  const adherenceRate = Math.round((perWeek.reduce((a, b) => a + b, 0) / perWeek.length) * 100);

  return {
    currentStreak,
    bestStreak,
    totalSessions: Object.values(state.days).reduce((a, b) => a + b, 0),
    totalDays: keys.length,
    todayDone,
    atRisk,
    weekCells,
    weekDone,
    weeklyGoal: state.weeklyGoal,
    goalReached: weekDone >= state.weeklyGoal,
    weeks,
    adherenceRate,
  };
}

export function withSession(state: PracticeState, now: Date = new Date()): PracticeState {
  const key = dayKey(now);
  return { ...state, days: { ...state.days, [key]: (state.days[key] ?? 0) + 1 } };
}

/** Demo pathway only: an illustrative history so the streak is visible immediately. */
export function withDemoHistory(state: PracticeState, now: Date = new Date()): PracticeState {
  if (Object.keys(state.days).length > 0) return state;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offsets = [1, 2, 3, 4, 6, 7, 9, 10, 13, 14, 16, 20];
  const days: Record<string, number> = {};
  offsets.forEach((offset) => {
    days[dayKey(addDays(today, -offset))] = 1;
  });
  return { ...state, days, demo: true };
}

export function clearHistory(state: PracticeState): PracticeState {
  return { ...state, days: {}, lastNotified: null, demo: false };
}

// ── Reminders ──────────────────────────────────────────────

export function reminderIsDue(state: PracticeState, stats: PracticeStats, now: Date = new Date()) {
  if (!state.reminder.enabled || stats.todayDone) return false;
  const [h, m] = state.reminder.time.split(':').map(Number);
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

/** A daily-recurring calendar event with an alarm; works even when the app is closed. */
export function buildIcs(args: { time: string; summary: string; description: string; now?: Date }) {
  const now = args.now ?? new Date();
  const [h, m] = args.time.split(':').map(Number);
  const start = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}T${pad(h)}${pad(m)}00`;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HIMAM//Home Practice//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:himam-home-practice@himam',
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escape(args.summary)}`,
    `DESCRIPTION:${escape(args.description)}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escape(args.summary)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'himam-home-practice.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
