import { effect, inject, Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Company } from './models';
import { SupabaseService } from './supabase.service';

const CACHE_KEY = 'aletes.empresa';

function readCache(): Company | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Company) : null;
  } catch {
    return null;
  }
}

/**
 * Datos de la empresa (nombre y logo de la cabecera). Se guardan en localStorage para que el
 * logo salga al instante al abrir la app, y se refrescan de la BBDD al iniciar sesión.
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly api = inject(ApiService);
  readonly company = signal<Company | null>(readCache());

  constructor() {
    const supabase = inject(SupabaseService);
    effect(() => {
      if (supabase.session()) this.refresh();
    });
  }

  /** Tras guardar en Perfil: actualiza la cabecera y la caché sin volver a pedirla. */
  set(c: Company) {
    this.company.set(c);
    this.cache(c);
  }

  private cache(c: Company | null) {
    try {
      if (c) localStorage.setItem(CACHE_KEY, JSON.stringify(c));
      else localStorage.removeItem(CACHE_KEY);
    } catch {
      // Sin almacenamiento (modo privado): solo se pierde la caché.
    }
  }

  private refresh() {
    this.api.getCompany().subscribe({
      next: (c) => {
        this.company.set(c);
        this.cache(c);
      },
      // Sin conexión se queda con lo cacheado.
      error: () => undefined,
    });
  }
}
