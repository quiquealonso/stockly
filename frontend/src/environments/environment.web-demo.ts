/**
 * Demo web (GitHub Pages): la app funciona con datos FICTICIOS en memoria (core/demo/), sin
 * Supabase ni login real. No importa `environment.local.ts`, así que no lleva ninguna clave.
 *   npm run demo        ·        npm run build:demo  (→ ../docs/demo)
 */
export const environment = {
  production: true,
  demo: true,
  supabaseUrl: '',
  supabaseSchema: 'aletes',
  supabaseAnonKey: '',
};
