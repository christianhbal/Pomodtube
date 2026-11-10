import * as SecureStore from 'expo-secure-store';
import { NativeModules, Platform } from 'react-native';
import type { StudySession } from './sessionHistory';

const STORAGE_KEY = 'foco.auth.v1';

export function getApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  // Si está configurada una URL remota explícita (ej. producción en Render o Railway)
  if (
    configured &&
    !configured.includes('127.0.0.1') &&
    !configured.includes('localhost')
  ) {
    return configured.replace(/\/+$/, '');
  }

  // En la web del navegador: usar el mismo hostname de la ventana (localhost, 127.0.0.1 o IP local)
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location?.hostname
  ) {
    return `http://${window.location.hostname}:3001`;
  }

  // En dispositivo móvil (físico o emulador): detectar la IP de la máquina donde corre Metro
  const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (scriptURL) {
    try {
      const match = scriptURL.match(/^https?:\/\/([^/:]+)/);
      if (
        match?.[1] &&
        match[1] !== '127.0.0.1' &&
        match[1] !== 'localhost'
      ) {
        return `http://${match[1]}:3001`;
      }
    } catch {
      // Usar fallback
    }
  }

  return (configured ?? 'http://127.0.0.1:3001').replace(/\/+$/, '');
}

export type AuthUser = {
  id: string;
  email?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  user: AuthUser;
};

type ApiError = { error?: string };

type RemoteSession = {
  id: string;
  phase: StudySession['phase'];
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

export class AuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, status = 0) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** El proveedor de auth registra acá qué hacer si el refresh token ya no sirve. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

async function readRaw(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  return SecureStore.getItemAsync(STORAGE_KEY);
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, value);
    } catch {
      // Sin almacenamiento: la sesión dura lo que dure la pestaña.
    }
    return;
  }

  await SecureStore.setItemAsync(STORAGE_KEY, value);
}

async function removeRaw(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      // Nada que borrar.
    }
    return;
  }

  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

export async function getStoredSession(): Promise<AuthSession | null> {
  let raw: string | null;

  try {
    raw = await readRaw();
  } catch {
    return null;
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user?.id) {
      return null;
    }
    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: AuthSession): Promise<void> {
  await writeRaw(JSON.stringify(session));
}

export async function clearStoredSession(): Promise<void> {
  await removeRaw();
}

export function isExpiring(session: AuthSession): boolean {
  return Boolean(
    session.expiresAt && session.expiresAt * 1000 <= Date.now() + 60_000,
  );
}

async function parseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function authRequest(
  path: string,
  body: unknown,
): Promise<AuthSession> {
  let response: Response;

  try {
    response = await fetch(`${getApiUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthError('network_error');
  }

  const data = await parseJson<AuthSession & ApiError>(response);

  if (!response.ok) {
    throw new AuthError(data?.error ?? 'request_failed', response.status);
  }

  if (!data?.accessToken || !data.refreshToken || !data.user?.id) {
    throw new AuthError('invalid_response', response.status);
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    user: data.user,
  };
}

export function loginWithPassword(
  email: string,
  password: string,
): Promise<AuthSession> {
  return authRequest('/v1/auth/login', { email, password });
}

export function registerWithInvite(
  email: string,
  password: string,
  inviteCode: string,
): Promise<AuthSession> {
  return authRequest('/v1/auth/register', { email, password, inviteCode });
}

export async function refreshStoredSession(): Promise<AuthSession | null> {
  const current = await getStoredSession();
  if (!current) return null;

  let response: Response;

  try {
    response = await fetch(`${getApiUrl()}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
  } catch {
    throw new AuthError('network_error');
  }

  if (!response.ok) {
    if (response.status === 401) {
      await clearStoredSession();
      return null;
    }
    throw new AuthError('refresh_failed', response.status);
  }

  const data = await parseJson<AuthSession>(response);

  if (!data?.accessToken || !data.refreshToken || !data.user?.id) {
    await clearStoredSession();
    return null;
  }

  await saveSession(data);
  return data;
}

export async function authedFetch(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Response> {
  const session = await getStoredSession();
  if (!session) throw new AuthError('unauthorized', 401);

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;

  try {
    response = await fetch(`${getApiUrl()}${path}`, { ...options, headers });
  } catch {
    throw new AuthError('network_error');
  }

  if (response.status === 401 && retry) {
    const refreshed = await refreshStoredSession();

    if (refreshed) return authedFetch(path, options, false);

    unauthorizedHandler?.();
    throw new AuthError('unauthorized', 401);
  }

  return response;
}

export async function fetchRemoteSessions(): Promise<StudySession[]> {
  const response = await authedFetch('/v1/sessions?limit=200');

  if (!response.ok) {
    throw new AuthError('sessions_failed', response.status);
  }

  const data = await parseJson<{ sessions?: RemoteSession[] }>(response);

  return (data?.sessions ?? []).map((session) => ({
    id: session.id,
    phase: session.phase,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSeconds: session.durationSeconds,
  }));
}

export async function postRemoteSession(
  session: StudySession,
): Promise<void> {
  const response = await authedFetch('/v1/sessions', {
    method: 'POST',
    body: JSON.stringify({
      id: session.id,
      phase: session.phase,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds: session.durationSeconds,
    }),
  });

  if (!response.ok) {
    throw new AuthError('session_failed', response.status);
  }
}

export function authErrorMessage(error: unknown): string {
  if (!(error instanceof AuthError)) {
    return 'Algo salió mal. Probá de nuevo.';
  }

  switch (error.code) {
    case 'invalid_credentials':
      return 'Email o contraseña incorrectos.';
    case 'invalid_invite_code':
      return 'El código de invitación no es correcto.';
    case 'email_taken':
      return 'Ese email ya está registrado.';
    case 'validation_error':
      return 'Revisá los datos: la contraseña necesita 8 caracteres o más.';
    case 'register_failed':
      return 'No se pudo crear la cuenta. Probá de nuevo.';
    case 'network_error':
      return 'No pude conectar con el servidor.';
    case 'unauthorized':
      return 'Tu sesión venció. Iniciá sesión de nuevo.';
    default:
      return 'Algo salió mal. Probá de nuevo.';
  }
}
