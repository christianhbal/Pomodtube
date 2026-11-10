import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { corsOrigins, env } from './env.js';
import { authRoutes } from './auth.js';
import { configRoutes } from './config.js';
import { goalRoutes } from './goals.js';
import { healthRoutes } from './health.js';
import { sessionRoutes } from './sessions.js';

const BODY_LIMIT_BYTES = 16 * 1024;

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Nunca loguear credenciales.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    bodyLimit: BODY_LIMIT_BYTES,
    connectionTimeout: 10_000,
    requestTimeout: 15_000,
    trustProxy: env.NODE_ENV === 'production',
  });

  // Cabeceras de seguridad (CSP se desactiva: la API solo devuelve JSON).
  await app.register(helmet, { contentSecurityPolicy: false });

  // CORS con allowlist explícita. Sin `*` y sin credenciales.
  // Se aceptan los dominios de Expo Hosting (*.expo.app) porque la web
  // se publica ahí y la URL cambia en cada deploy.
  const expoHostedOrigin = /^https:\/\/([a-z0-9-]+\.)*expo\.app$/i;

  await app.register(cors, {
    origin(origin, callback) {
      // Un origen no permitido simplemente no recibe cabeceras CORS;
      // el navegador bloquea la petición, pero la API no falla.
      const isDevLocal =
        env.NODE_ENV === 'development' &&
        Boolean(
          origin &&
            /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(
              origin,
            ),
        );

      const allowed =
        !origin ||
        corsOrigins.includes(origin) ||
        expoHostedOrigin.test(origin) ||
        isDevLocal;

      if (origin && !allowed) {
        // Deja rastro para diagnosticar orígenes nuevos.
        console.warn(`[cors] origen rechazado: ${origin}`);
      }

      callback(null, allowed);
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    credentials: false,
    maxAge: 86_400,
  });

  // Límite global de requests por IP.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Nunca filtrar stack traces ni detalles internos al cliente.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'request_failed');

    const status =
      typeof error.statusCode === 'number' && error.statusCode >= 400
        ? error.statusCode
        : 500;

    if (status >= 500) {
      reply.status(500).send({ error: 'internal_error' });
      return;
    }

    reply.status(status).send({ error: 'request_error' });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: 'not_found' });
  });

  await app.register(healthRoutes);
  await app.register(configRoutes, { prefix: '/v1' });
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(sessionRoutes, { prefix: '/v1' });
  await app.register(goalRoutes, { prefix: '/v1' });

  return app;
}
