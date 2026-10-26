/**
 * PLANTILLA de configuración de Supabase. La app NO usa este fichero: al compilar se sustituye
 * por `environment.local.ts` (ignorado por git), que tiene los valores reales:
 *
 *   cp src/environments/environment.ts src/environments/environment.local.ts
 *
 * y rellena (Supabase > Project Settings > API):
 *  - supabaseUrl:     Project URL
 *  - supabaseAnonKey: clave "publishable" / "anon public". Es pública por diseño: la seguridad
 *                     la dan el login y las políticas RLS de supabase/schema.sql.
 *  - supabaseSchema:  esquema donde se ejecutó schema.sql (por defecto `aletes`).
 *  ¡NUNCA pongas aquí la contraseña de la base de datos ni la clave service_role!
 */
export const environment = {
  production: false,
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseSchema: 'aletes',
  supabaseAnonKey: 'sb_publishable_…',
};
