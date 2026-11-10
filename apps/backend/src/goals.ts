import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from './auth.js';
import { supabaseForUser } from './supabase.js';

const GOAL_KINDS = ['goal', 'exam'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

const CreateGoalSchema = z.object({
  kind: z.enum(GOAL_KINDS),
  title: z.string().trim().min(1).max(120),
});

const IdParamsSchema = z.object({ id: z.string().uuid() });

type GoalRow = {
  id: string;
  kind: GoalKind;
  title: string;
  created_at: string;
};

function toGoal(row: GoalRow) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    createdAt: row.created_at,
  };
}

export async function goalRoutes(app: FastifyInstance): Promise<void> {
  app.get('/goals', { preHandler: requireUser }, async (request) => {
    const supabase = supabaseForUser(request.accessToken);
    const { data, error } = await supabase
      .from('goals')
      .select('id, kind, title, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    return { goals: (data as GoalRow[]).map(toGoal) };
  });

  app.post(
    '/goals',
    { preHandler: requireUser },
    async (request, reply) => {
      const result = CreateGoalSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({ error: 'validation_error' });
      }

      const supabase = supabaseForUser(request.accessToken);
      const { data, error } = await supabase
        .from('goals')
        .insert({
          id: randomUUID(),
          user_id: request.user.id,
          kind: result.data.kind,
          title: result.data.title,
        })
        .select('id, kind, title, created_at')
        .single();

      if (error) throw error;

      return reply.status(201).send({ goal: toGoal(data as GoalRow) });
    },
  );

  app.delete(
    '/goals/:id',
    { preHandler: requireUser },
    async (request, reply) => {
      const params = IdParamsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.status(400).send({ error: 'validation_error' });
      }

      const supabase = supabaseForUser(request.accessToken);
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', params.data.id);

      if (error) throw error;

      return reply.status(204).send();
    },
  );
}
