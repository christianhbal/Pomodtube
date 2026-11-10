import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'pomodoro.sessions.v1';
const MAX_SESSIONS = 2000;

export type SessionPhase = 'focus' | 'short' | 'long';

export type StudySession = {
  id: string;
  phase: SessionPhase;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

export type DayStat = {
  key: string;
  label: string;
  minutes: number;
  isToday: boolean;
};

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

let cache: StudySession[] | null = null;
const listeners = new Set<() => void>();
let writeQueue: Promise<unknown> = Promise.resolve();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeSessions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function ensureLoaded(): Promise<StudySession[]> {
  if (cache) return cache;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? (parsed as StudySession[]) : [];
  } catch {
    cache = [];
  }

  return cache;
}

export function loadSessions(): Promise<StudySession[]> {
  return ensureLoaded();
}

/** Serializa escrituras para no pisar sesiones si coinciden sync + timer. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function addSession(
  input: Omit<StudySession, 'id'>,
): Promise<StudySession> {
  const session: StudySession = {
    ...input,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  };

  await enqueue(async () => {
    const current = await ensureLoaded();
    const next = [...current, session].slice(-MAX_SESSIONS);
    cache = next;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notify();
  });

  return session;
}

/** Agrega/actualiza el historial sin perder sesiones locales recientes. */
export async function mergeIntoHistory(
  sessions: StudySession[],
): Promise<void> {
  await enqueue(async () => {
    const current = await ensureLoaded();
    const next = mergeSessions(current, sessions);
    cache = next;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notify();
  });
}

/** Une local + remoto sin duplicar por `id`; el remoto gana. */
function mergeSessions(
  local: StudySession[],
  remote: StudySession[],
): StudySession[] {
  const byId = new Map<string, StudySession>();

  for (const session of [...local, ...remote]) {
    byId.set(session.id, session);
  }

  return [...byId.values()]
    .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
    .slice(-MAX_SESSIONS);
}

/** Al cerrar sesión no dejamos el historial de otra persona en el dispositivo. */
export async function clearSessions(): Promise<void> {
  await enqueue(async () => {
    cache = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
    notify();
  });
}

function startOfWeek(now: Date): Date {
  const day = now.getDay(); // 0 = domingo
  const diff = (day + 6) % 7; // lunes = 0
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Minutos de foco por día de la semana actual (lunes a domingo).
 * Solo cuenta fases `focus`: las pausas no son tiempo de estudio.
 */
export function getWeekStats(
  sessions: StudySession[],
  now = new Date(),
): DayStat[] {
  const monday = startOfWeek(now);

  return DAY_LABELS.map((label, index) => {
    const dayStart = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + index,
    );
    const dayEnd = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + index + 1,
    );

    const minutes = sessions.reduce((sum, session) => {
      if (session.phase !== 'focus') return sum;

      const ended = new Date(session.endedAt).getTime();
      if (ended >= dayStart.getTime() && ended < dayEnd.getTime()) {
        return sum + session.durationSeconds / 60;
      }
      return sum;
    }, 0);

    return {
      key: dayStart.toISOString().slice(0, 10),
      label,
      minutes: Math.round(minutes),
      isToday: isSameDay(dayStart, now),
    };
  });
}
