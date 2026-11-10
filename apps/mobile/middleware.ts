/**
 * Basic Auth para que la web sea privada.
 *
 * Configurá APP_USER y APP_PASSWORD en Vercel:
 * Project → Settings → Environment Variables.
 *
 * Si faltan, el middleware cierra el acceso (fail closed).
 */
export const config = {
  matcher: '/(.*)',
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export default function middleware(request: Request): Response | undefined {
  const user = process.env.APP_USER;
  const password = process.env.APP_PASSWORD;

  if (!user || !password) {
    return new Response('Falta configurar APP_USER y APP_PASSWORD.', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const header = request.headers.get('authorization');

  if (header?.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const separator = decoded.indexOf(':');

      if (separator !== -1) {
        const providedUser = decoded.slice(0, separator);
        const providedPassword = decoded.slice(separator + 1);

        if (
          safeEqual(providedUser, user) &&
          safeEqual(providedPassword, password)
        ) {
          return undefined;
        }
      }
    } catch {
      // Header malformado: sigue al 401.
    }
  }

  return new Response('Acceso restringido.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Foco", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}
