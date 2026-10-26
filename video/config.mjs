// Datos comunes de los scripts del vídeo, sacados de la configuración local del front
// (frontend/src/environments/environment.local.ts, ignorado por git).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
/** App demo (`ng serve --configuration demo`). */
export const APP = 'http://localhost:4300';
/** Sesión del usuario demo guardada por login.mjs (ignorada por git). */
export const SESSION = join(HERE, '.sesion-demo.json');

const envLocal = readFileSync(
  join(HERE, '..', 'frontend', 'src', 'environments', 'environment.local.ts'),
  'utf8',
);
const ref = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(envLocal)?.[1];
if (!ref) throw new Error('No se encuentra supabaseUrl en environment.local.ts');

/** Clave de localStorage donde supabase-js guarda la sesión. */
export const TOKEN_KEY = `sb-${ref}-auth-token`;
