import { environment } from '../../../environments/environment';

/** Demo web (environment.web-demo.ts): datos ficticios en memoria en lugar de Supabase. */
export const DEMO = 'demo' in environment && environment.demo === true;
