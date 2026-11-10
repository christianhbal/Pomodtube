import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Carga .env antes de que se evalúe `env.ts`. Este módulo se importa primero.
const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/backend/.env'),
  resolve(fileURLToPath(new URL('..', import.meta.url)), '.env'),
];

for (const path of candidates) {
  if (existsSync(path)) {
    process.loadEnvFile(path);
    break;
  }
}

