import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useI18n } from '../i18n';
import {
  buildIcs,
  clearHistory,
  computeStats,
  dayKey,
  downloadIcs,
  loadState,
  reminderIsDue,
  saveState,
  withDemoHistory,
  withSession,
  type PracticeState,
  type PracticeStats,
} from './practice';

export type NotifPermission = 'granted' | 'denied' | 'default' | 'unsupported';

type PracticeValue = {
  state: PracticeState;
  stats: PracticeStats;
  reminderDue: boolean;
  notifPermission: NotifPermission;
  logSession: () => void;
  seedDemo: () => void;
  resetHistory: () => void;
  setWeeklyGoal: (goal: number) => void;
  setReminderEnabled: (enabled: boolean) => void;
  setReminderTime: (time: string) => void;
  requestNotifications: () => Promise<void>;
  downloadCalendar: () => void;
};

const PracticeContext = createContext<PracticeValue | null>(null);

function currentPermission(): NotifPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export function PracticeProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<PracticeState>(loadState);
  const [now, setNow] = useState(() => new Date());
  const [notifPermission, setNotifPermission] = useState<NotifPermission>(currentPermission);

  // persist
  useEffect(() => {
    saveState(state);
  }, [state]);

  // tick every 30 s so the streak rolls over at midnight and reminders fire on time
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const stats = useMemo(() => computeStats(state, now), [state, now]);
  const reminderDue = reminderIsDue(state, stats, now);

  // fire one browser notification per day when the reminder time passes
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    if (!reminderDue || notifPermission !== 'granted') return;
    const today = dayKey(now);
    if (state.lastNotified === today) return;
    try {
      new Notification(tRef.current('pp.notif.title'), {
        body: tRef.current('pp.notif.body'),
        icon: `${import.meta.env.BASE_URL}logo.png`,
        tag: 'himam-practice',
      });
    } catch {
      /* some mobile browsers only allow notifications from a service worker */
    }
    setState((current) => ({ ...current, lastNotified: today }));
  }, [reminderDue, notifPermission, now, state.lastNotified]);

  const logSession = useCallback(() => {
    setNow(new Date());
    setState((current) => withSession(current));
  }, []);

  const value = useMemo<PracticeValue>(
    () => ({
      state,
      stats,
      reminderDue,
      notifPermission,
      logSession,
      seedDemo: () => setState((current) => withDemoHistory(current)),
      resetHistory: () => setState((current) => clearHistory(current)),
      setWeeklyGoal: (goal) => setState((current) => ({ ...current, weeklyGoal: goal })),
      setReminderEnabled: (enabled) =>
        setState((current) => ({ ...current, reminder: { ...current.reminder, enabled } })),
      setReminderTime: (time) =>
        setState((current) => ({ ...current, reminder: { ...current.reminder, time }, lastNotified: null })),
      requestNotifications: async () => {
        if (typeof Notification === 'undefined') {
          setNotifPermission('unsupported');
          return;
        }
        try {
          const result = await Notification.requestPermission();
          setNotifPermission(result);
        } catch {
          setNotifPermission(currentPermission());
        }
      },
      downloadCalendar: () =>
        downloadIcs(
          buildIcs({
            time: state.reminder.time,
            summary: tRef.current('pp.ics.summary'),
            description: tRef.current('pp.ics.description'),
          }),
        ),
    }),
    [state, stats, reminderDue, notifPermission, logSession],
  );

  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
}

export function usePractice() {
  const value = useContext(PracticeContext);
  if (!value) throw new Error('usePractice must be used inside <PracticeProvider>');
  return value;
}
