import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import { addSession, type StudySession } from '../lib/sessionHistory';

export const PHASES = {
  focus: { label: 'Foco', minutes: 25 },
  short: { label: 'Pausa corta', minutes: 5 },
  long: { label: 'Pausa larga', minutes: 15 },
} as const;

export type Phase = keyof typeof PHASES;

/** Pomodoro con fases, o cronómetro libre que corre hasta detenerlo. */
export type Mode = 'pomodoro' | 'tryhard';

/** Focos completados antes de una pausa larga. */
const CYCLE = 4;
const STORAGE_KEY = 'pomodoro.state.v1';

/** Tope por sesión que acepta la API; lo que dure más se parte en tramos. */
const MAX_SESSION_SECONDS = 4 * 60 * 60;

export function secondsFor(phase: Phase): number {
  return PHASES[phase].minutes * 60;
}

function nextPhase(current: Phase, completed: number): Phase {
  if (current !== 'focus') return 'focus';
  return completed % CYCLE === 0 ? 'long' : 'short';
}

/**
 * Guarda la sesión terminada para las estadísticas semanales.
 * Se registran todas las fases; las estadísticas solo suman `focus`.
 */
function persistSession(
  phase: Phase,
  startedAt: number,
  endedAt: number,
  durationSeconds: number,
): Promise<StudySession | null> {
  return addSession({
    phase,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationSeconds,
  }).catch(() => null);
}

function recordCompleted(
  phase: Phase,
  endedAt: number,
): Promise<StudySession | null> {
  const durationSeconds = secondsFor(phase);
  return persistSession(phase, endedAt - durationSeconds * 1000, endedAt, durationSeconds);
}

/**
 * El cronómetro libre no tiene tope, pero la API rechaza tramos de más de
 * 4 horas. Se parte en sesiones contiguas para no perder tiempo.
 */
function recordFree(totalSeconds: number, endedAt: number): Promise<StudySession | null>[] {
  const chunks: { startedAt: number; endedAt: number; durationSeconds: number }[] = [];
  let left = Math.max(1, Math.floor(totalSeconds));
  let end = endedAt;

  while (left > 0) {
    const durationSeconds = Math.min(left, MAX_SESSION_SECONDS);
    chunks.unshift({ startedAt: end - durationSeconds * 1000, endedAt: end, durationSeconds });
    end -= durationSeconds * 1000;
    left -= durationSeconds;
  }

  return chunks.map((chunk) =>
    persistSession('focus', chunk.startedAt, chunk.endedAt, chunk.durationSeconds),
  );
}

type Persisted = {
  mode?: Mode;
  phase: Phase;
  endAt: number | null;
  remaining: number;
  completed: number;
  tryStartedAt?: number | null;
  tryBase?: number;
};

export type PomodoroApi = ReturnType<typeof usePomodoro>;

type Options = {
  onSessionCompleted?: (session: StudySession) => void;
};

/**
 * Motor del Pomodoro.
 *
 * El estado crítico es `endAt` (timestamp de fin), no un contador. Así el
 * tiempo sigue siendo correcto aunque la app se suspenda, se minimice o se
 * recargue el bundle: al volver, se recalcula desde `Date.now()`.
 */
export function usePomodoro(options: Options = {}) {
  const [mode, setModeState] = useState<Mode>('pomodoro');
  const [phase, setPhase] = useState<Phase>('focus');
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(() => secondsFor('focus'));
  const [completed, setCompleted] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Cronómetro libre: `tryBase` son los segundos ya acumulados y
  // `tryStartedAt` el arranque del tramo actual (null si está en pausa).
  const [tryStartedAt, setTryStartedAt] = useState<number | null>(null);
  const [tryBase, setTryBase] = useState(0);
  const [tryElapsed, setTryElapsed] = useState(0);

  const phaseRef = useRef<Phase>(phase);
  const completedRef = useRef(completed);
  const finishedRef = useRef(false);
  const onSessionCompletedRef = useRef(options.onSessionCompleted);

  useEffect(() => {
    onSessionCompletedRef.current = options.onSessionCompleted;
  }, [options.onSessionCompleted]);

  const record = useCallback((phase: Phase, endedAt: number) => {
    recordCompleted(phase, endedAt)
      .then((session) => {
        if (session) onSessionCompletedRef.current?.(session);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  // Restaurar la sesión anterior (sobrevive a recargas y reinicios).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw || cancelled) return;

        const saved = JSON.parse(raw) as Persisted;
        if (!saved || !(saved.phase in PHASES)) return;

        const done = saved.completed ?? 0;

        if (saved.mode === 'tryhard') {
          const base = saved.tryBase ?? 0;
          const startedAt = saved.tryStartedAt ?? null;

          setModeState('tryhard');
          setTryBase(base);
          setTryStartedAt(startedAt);
          setTryElapsed(
            startedAt === null
              ? base
              : base + Math.floor((Date.now() - startedAt) / 1000),
          );
        }

        if (saved.endAt) {
          const left = Math.max(
            0,
            Math.ceil((saved.endAt - Date.now()) / 1000),
          );

          if (left > 0) {
            phaseRef.current = saved.phase;
            completedRef.current = done;
            setPhase(saved.phase);
            setCompleted(done);
            setRemaining(left);
            setEndAt(saved.endAt);
            return;
          }

          // Terminó mientras la app estaba cerrada.
          record(saved.phase, saved.endAt);
          const after = done + 1;
          const next = nextPhase(saved.phase, after);
          phaseRef.current = next;
          completedRef.current = after;
          setPhase(next);
          setCompleted(after);
          setRemaining(secondsFor(next));
          return;
        }

        phaseRef.current = saved.phase;
        completedRef.current = done;
        setPhase(saved.phase);
        setCompleted(done);
        setRemaining(saved.remaining ?? secondsFor(saved.phase));
      } catch {
        // Estado corrupto: arrancamos de cero.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [record]);

  // Persistir en cada transición (no en cada tick).
  useEffect(() => {
    if (!hydrated) return;
    const payload: Persisted = {
      mode,
      phase,
      endAt,
      remaining,
      completed,
      tryStartedAt,
      tryBase,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
    // `remaining` y `tryElapsed` se omiten a propósito: mientras corre se
    // recalculan desde `endAt` y `tryStartedAt`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, mode, phase, endAt, completed, tryStartedAt, tryBase]);

  // Tick: solo para pintar. La verdad la manda `endAt`.
  useEffect(() => {
    if (endAt === null) return;
    finishedRef.current = false;

    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(left);

      if (left > 0 || finishedRef.current) return;
      finishedRef.current = true;

      Vibration.vibrate([0, 350, 150, 350]);

      record(phaseRef.current, endAt);

      const done = completedRef.current + 1;
      const next = nextPhase(phaseRef.current, done);

      completedRef.current = done;
      phaseRef.current = next;
      setCompleted(done);
      setPhase(next);
      setRemaining(secondsFor(next));
      setEndAt(null);
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endAt, record]);

  const start = useCallback(() => {
    if (endAt !== null) return;
    setEndAt(Date.now() + remaining * 1000);
  }, [endAt, remaining]);

  const pause = useCallback(() => {
    if (endAt === null) return;
    setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    setEndAt(null);
  }, [endAt]);

  const reset = useCallback(() => {
    setEndAt(null);
    setRemaining(secondsFor(phaseRef.current));
  }, []);

  const skip = useCallback(() => {
    const done =
      phaseRef.current === 'focus' ? completedRef.current + 1 : completedRef.current;
    const next = nextPhase(phaseRef.current, done);

    completedRef.current = done;
    phaseRef.current = next;
    setCompleted(done);
    setPhase(next);
    setRemaining(secondsFor(next));
    setEndAt(null);
  }, []);

  const toggle = useCallback(() => {
    if (endAt === null) start();
    else pause();
  }, [endAt, start, pause]);

  // Tick del cronómetro libre: solo pinta el tiempo transcurrido.
  useEffect(() => {
    if (mode !== 'tryhard' || tryStartedAt === null) return;

    const tick = () => {
      setTryElapsed(
        tryBase + Math.floor((Date.now() - tryStartedAt) / 1000),
      );
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [mode, tryStartedAt, tryBase]);

  const startTryhard = useCallback(() => {
    setTryStartedAt((current) => current ?? Date.now());
  }, []);

  const pauseTryhard = useCallback(() => {
    if (tryStartedAt === null) return;

    const base = tryBase + Math.floor((Date.now() - tryStartedAt) / 1000);
    setTryBase(base);
    setTryElapsed(base);
    setTryStartedAt(null);
  }, [tryStartedAt, tryBase]);

  /** Detiene el cronómetro y guarda lo estudiado como sesiones de foco. */
  const stopTryhard = useCallback(() => {
    const elapsed =
      tryStartedAt === null
        ? tryBase
        : tryBase + Math.floor((Date.now() - tryStartedAt) / 1000);

    if (elapsed >= 1) {
      for (const pending of recordFree(elapsed, Date.now())) {
        pending
          .then((session) => {
            if (session) onSessionCompletedRef.current?.(session);
          })
          .catch(() => {});
      }
    }

    setTryStartedAt(null);
    setTryBase(0);
    setTryElapsed(0);
  }, [tryStartedAt, tryBase]);

  /** Reinicia el cronómetro sin guardar nada. */
  const discardTryhard = useCallback(() => {
    setTryStartedAt(null);
    setTryBase(0);
    setTryElapsed(0);
  }, []);

  /** Cambia de modo pausando lo que esté corriendo. */
  const setMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;

      if (mode === 'pomodoro') {
        if (endAt !== null) {
          setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
          setEndAt(null);
        }
      } else {
        pauseTryhard();
      }

      setModeState(next);
    },
    [mode, endAt, pauseTryhard],
  );

  const total = secondsFor(phase);
  const progress = Math.min(1, Math.max(0, 1 - remaining / total));
  const cycle = (completed % CYCLE) + 1;

  return {
    mode,
    setMode,
    phase,
    remaining,
    total,
    progress,
    running: endAt !== null,
    completed,
    cycle,
    cycleSize: CYCLE,
    start,
    pause,
    reset,
    skip,
    toggle,
    tryhard: {
      elapsed: tryElapsed,
      running: tryStartedAt !== null,
      start: startTryhard,
      pause: pauseTryhard,
      stop: stopTryhard,
      discard: discardTryhard,
    },
  };
}
