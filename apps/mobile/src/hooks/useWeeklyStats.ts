import { useEffect, useState } from 'react';
import {
  getWeekStats,
  loadSessions,
  subscribeSessions,
  type StudySession,
} from '../lib/sessionHistory';

export function useWeeklyStats() {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      loadSessions().then((next) => {
        if (cancelled) return;
        setSessions(next);
        setReady(true);
      });
    };

    refresh();
    const unsubscribe = subscribeSessions(refresh);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const days = getWeekStats(sessions);
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0);

  return { days, totalMinutes, sessions, ready };
}
