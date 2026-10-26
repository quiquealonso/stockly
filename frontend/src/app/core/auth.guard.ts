import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

/** Solo deja pasar a usuarios con sesión iniciada. */
export const authGuard: CanActivateFn = async () => {
  // inject() antes de cualquier await (contexto de inyección).
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  await supabase.ready;
  return supabase.session() ? true : router.createUrlTree(['/login']);
};

/** Si ya hay sesión, /login redirige al stock. */
export const loginGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  await supabase.ready;
  return supabase.session() ? router.createUrlTree(['/stock']) : true;
};
