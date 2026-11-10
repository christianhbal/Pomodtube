import { z } from 'zod';

export const PHASES = ['focus', 'short', 'long'] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_SECONDS: Record<Phase, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

export const MAX_SESSION_SECONDS = 4 * 60 * 60;

/**
 * Contrato de entrada para registrar una sesión.
 * Todo lo que llega por HTTP se valida acá: nada entra sin pasar por Zod.
 */
export const CreateSessionSchema = z
  .object({
    id: z.string().min(1).max(64).optional(),
    phase: z.enum(PHASES),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date(),
    durationSeconds: z.number().int().min(1).max(MAX_SESSION_SECONDS),
    completed: z.boolean().default(true),
  })
  .refine((value) => value.endedAt.getTime() >= value.startedAt.getTime(), {
    message: 'endedAt no puede ser anterior a startedAt',
    path: ['endedAt'],
  })
  .refine(
    (value) =>
      value.endedAt.getTime() - value.startedAt.getTime() <=
      MAX_SESSION_SECONDS * 1000,
    {
      message: 'La sesión no puede durar más de 4 horas',
      path: ['endedAt'],
    },
  );

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
