import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  clearStoredSession,
  fetchRemoteSessions,
  getStoredSession,
  isExpiring,
  loginWithPassword,
  postRemoteSession,
  refreshStoredSession,
  registerWithInvite,
  saveSession,
  setUnauthorizedHandler,
  type AuthSession,
  type AuthUser,
} from '../lib/auth';
import {
  clearSessions,
  loadSessions,
  mergeIntoHistory,
  type StudySession,
} from '../lib/sessionHistory';

const MAX_SYNC_PER_LOGIN = 80;

type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    inviteCode: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  syncSession: (session: StudySession) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Baja el historial remoto, lo une con el local y sube lo que falte.
 * El backend hace upsert por `id`, así que reintentar es seguro.
 */
async function syncHistory(userId: string): Promise<void> {
  try {
    const [remote, local] = await Promise.all([
      fetchRemoteSessions(),
      loadSessions(),
    ]);

    const current = await getStoredSession();
    if (!current || current.user.id !== userId) return;

    const remoteIds = new Set(remote.map((session) => session.id));
    const localOnly = local
      .filter((session) => !remoteIds.has(session.id))
      .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
      .slice(-MAX_SYNC_PER_LOGIN);

    await mergeIntoHistory(remote);

    for (const session of localOnly) {
      const stillCurrent = await getStoredSession();
      if (!stillCurrent || stillCurrent.user.id !== userId) return;
      await postRemoteSession(session).catch(() => undefined);
    }
  } catch {
    // Sin conexión o backend caído: seguimos con el historial local.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearSessions();
      setSession(null);
      setStatus('anonymous');
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  const applySession = useCallback(async (next: AuthSession) => {
    await saveSession(next);
    setSession(next);
    setStatus('authenticated');
    void syncHistory(next.user.id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await getStoredSession();

      if (cancelled) return;

      if (!stored) {
        setStatus('anonymous');
        return;
      }

      let next: AuthSession | null = stored;

      if (isExpiring(stored)) {
        try {
          next = await refreshStoredSession();
        } catch {
          next = null;
        }
      }

      if (cancelled) return;

      if (!next) {
        setStatus('anonymous');
        return;
      }

      await applySession(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      await applySession(await loginWithPassword(email, password));
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, inviteCode: string) => {
      await applySession(
        await registerWithInvite(email, password, inviteCode),
      );
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    await clearStoredSession().catch(() => undefined);
    await clearSessions().catch(() => undefined);
    setSession(null);
    setStatus('anonymous');
  }, []);

  const syncSession = useCallback(async (studySession: StudySession) => {
    try {
      await postRemoteSession(studySession);
    } catch {
      // Queda local; se reintenta en el próximo login.
    }
  }, []);

  const value: AuthContextValue = {
    status,
    user: session?.user ?? null,
    login,
    register,
    logout,
    syncSession,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return value;
}
