import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  message: string;
  /** Texto del botón de aceptar (por defecto "Aceptar"). */
  ok?: string;
  /** Pinta el botón de aceptar en rojo (borrados). */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

/**
 * Diálogo de confirmación propio (sustituye a confirm(): en algunos WebView/navegadores
 * integrados se cancela solo y devuelve false). Lo pinta `App`.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly current = signal<PendingConfirm | null>(null);

  ask(request: ConfirmRequest | string): Promise<boolean> {
    const req = typeof request === 'string' ? { message: request } : request;
    // Si hubiera uno abierto, se da por cancelado.
    this.current()?.resolve(false);
    return new Promise((resolve) => this.current.set({ ...req, resolve }));
  }

  answer(ok: boolean) {
    const pending = this.current();
    this.current.set(null);
    pending?.resolve(ok);
  }
}
