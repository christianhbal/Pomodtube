import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { requireUser } from './auth.js';
import { CreateSessionSchema, type Phase } from './session.js';
import { supabaseForUser } from './supabase.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type SessionRow = {
  id: string;
  phase: Phase;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  completed: boolean;
  created_at: string;
};

function toSession(row: SessionRow) {
  return {
    id: row.id,
    phase: row.phase,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    completed: row.completed,
    createdAt: row.created_at,
  };
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sessions', { preHandler: requireUser }, async (request) => {
    const { limit } = request.query as { limit?: string };
    const parsed = Number.parseInt(limit ?? '', 10);

    const safeLimit = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const supabase = supabaseForUser(request.accessToken);
    const { data, error } = await supabase
      .from('sessions')
      .select(
        'id, phase, started_at, ended_at, duration_seconds, completed, created_at',
      )
      .order('ended_at', { ascending: false })
      .limit(safeLimit);

    if (error) throw error;

    return { sessions: (data as SessionRow[]).map(toSession) };
  });

  app.post(
    '/sessions',
    { preHandler: requireUser },
    async (request, reply) => {
      const result = CreateSessionSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          error: 'validation_error',
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      const supabase = supabaseForUser(request.accessToken);
      const { data, error } = await supabase
        .from('sessions')
        .upsert(
          {
            id: result.data.id ?? randomUUID(),
            user_id: request.user.id,
            phase: result.data.phase,
            started_at: result.data.startedAt.toISOString(),
            ended_at: result.data.endedAt.toISOString(),
            duration_seconds: result.data.durationSeconds,
            completed: result.data.completed,
          },
          { onConflict: 'id' },
        )
        .select(
          'id, phase, started_at, ended_at, duration_seconds, completed, created_at',
        )
        .single();

      if (error) throw error;

      return reply.status(201).send({ session: toSession(data as SessionRow) });
    },
  );
}
