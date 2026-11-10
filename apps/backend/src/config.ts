import type { FastifyInstance } from 'fastify';
import { MAX_SESSION_SECONDS, PHASE_SECONDS } from './session.js';

export async function configRoutes(app: FastifyInstance): Promise<void> {
  app.get('/config', async () => ({
    phases: PHASE_SECONDS,
    limits: {
      maxDurationSeconds: MAX_SESSION_SECONDS,
    },
  }));
}
