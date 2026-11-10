import { timingSafeEqual } from 'node:crypto';
import type { Session, User } from '@supabase/supabase-js';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from './env.js';
import { supabaseAdmin, supabaseAuth } from './supabase.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email?: string };
    accessToken: string;
  }
}

const CredentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const RegisterSchema = CredentialsSchema.extend({
  inviteCode: z.string().min(1).max(128),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** Comparación en tiempo constante para el código de invitación. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function authResponse(session: Session, user: User) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    user: { id: user.id, email: user.email },
  };
}

/**
 * Valida el JWT de Supabase y deja el usuario en el request.
 * Las rutas privadas usan esto como preHandler.
 */
export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    await reply.status(401).send({ error: 'unauthorized' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    await reply.status(401).send({ error: 'unauthorized' });
    return;
  }

  request.user = { id: data.user.id, email: data.user.email };
  request.accessToken = token;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const result = RegisterSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({ error: 'validation_error' });
      }

      if (
        !env.SIGNUP_CODE ||
        !safeEqual(result.data.inviteCode, env.SIGNUP_CODE)
      ) {
        return reply.status(403).send({ error: 'invalid_invite_code' });
      }

      const email = result.data.email.toLowerCase();

      const { error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: result.data.password,
          email_confirm: true,
        });

      if (createError) {
        const taken =
          createError.code === 'email_exists' || createError.status === 422;
        return reply
          .status(taken ? 409 : 400)
          .send({ error: taken ? 'email_taken' : 'register_failed' });
      }

      const { data: login, error: loginError } =
        await supabaseAuth.auth.signInWithPassword({
          email,
          password: result.data.password,
        });

      if (loginError || !login.session || !login.user) {
        return reply.status(500).send({ error: 'register_failed' });
      }

      return reply.status(201).send(authResponse(login.session, login.user));
    },
  );

  app.post(
    '/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const result = CredentialsSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({ error: 'validation_error' });
      }

      const { data, error } = await supabaseAuth.auth.signInWithPassword({
        email: result.data.email.toLowerCase(),
        password: result.data.password,
      });

      if (error || !data.session || !data.user) {
        return reply.status(401).send({ error: 'invalid_credentials' });
      }

      return authResponse(data.session, data.user);
    },
  );

  app.get(
    '/me',
    { preHandler: requireUser },
    async (request) => ({ user: request.user }),
  );

  app.post(
    '/refresh',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const result = RefreshSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({ error: 'validation_error' });
      }

      const { data, error } = await supabaseAuth.auth.refreshSession({
        refresh_token: result.data.refreshToken,
      });

      if (error || !data.session || !data.user) {
        return reply.status(401).send({ error: 'invalid_refresh_token' });
      }

      return authResponse(data.session, data.user);
    },
  );
}
