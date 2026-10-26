import { Injectable, signal } from '@angular/core';
import { createClient, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/** Traduce los errores de autenticación más habituales. */
function authMessage(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(msg)) return 'Debes confirmar tu email antes de entrar.';
  if (/failed to fetch|network/i.test(msg)) return 'No se puede conectar con el servidor.';
  if (/too many requests|rate limit/i.test(msg)) return 'Demasiados intentos. Espera un momento.';
  return msg;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: { persistSession: true, autoRefreshToken: true },
      // Las tablas viven en su propio esquema (el proyecto de Supabase se puede compartir con otras apps).
      db: { schema: environment.supabaseSchema },
    },
  );

  /** Sesión actual (null si no ha iniciado sesión). */
  readonly session = signal<Session | null>(null);

  /** Se resuelve cuando ya se ha leído la sesión guardada (para los guards). */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
    });
    this.client.auth.onAuthStateChange((_event, session) => this.session.set(session));
  }

  get email(): string {
    return this.session()?.user?.email ?? '';
  }

  async login(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(authMessage(error.message));
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
  }
}
