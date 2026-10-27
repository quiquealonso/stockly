import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners, Provider } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { ApiService } from './core/api.service';
import { DEMO } from './core/demo/demo-mode';
import { DemoApiService, DemoSupabaseService } from './core/demo/demo.services';
import { SupabaseService } from './core/supabase.service';

// Números en formato español (12,5) en el pipe `number`.
registerLocaleData(localeEs);

const demoProviders: Provider[] = DEMO
  ? [
      { provide: SupabaseService, useClass: DemoSupabaseService },
      { provide: ApiService, useClass: DemoApiService },
    ]
  : [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // En GitHub Pages no hay reescritura de rutas: la demo usa #/ruta.
    provideRouter(routes, withComponentInputBinding(), ...(DEMO ? [withHashLocation()] : [])),
    { provide: LOCALE_ID, useValue: 'es' },
    ...demoProviders,
  ],
};
