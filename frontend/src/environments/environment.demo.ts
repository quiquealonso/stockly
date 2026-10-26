import { environment as local } from './environment.local';

/**
 * Entorno demo (vídeo de presentación): mismo proyecto de Supabase que `environment.local.ts`,
 * pero con el esquema `aletes_demo` (lo crea desde cero `video/crear-demo.mjs`).
 * `ng serve --configuration demo` → puerto 4300.
 */
export const environment = {
  ...local,
  supabaseSchema: 'aletes_demo',
};
