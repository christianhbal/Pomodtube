import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

const baseOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

/** Cliente público: login, validación de JWT y refresh. */
export const supabaseAuth = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  baseOptions,
);

/** Cliente admin: solo para crear usuarios desde el registro. */
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  baseOptions,
);

/** Cliente con el JWT del usuario: las consultas pasan por RLS. */
export function supabaseForUser(accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    ...baseOptions,
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
