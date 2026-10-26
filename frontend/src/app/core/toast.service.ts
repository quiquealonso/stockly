import { Injectable, signal } from '@angular/core';

export interface Toast {
  text: string;
  error: boolean;
}

/** Avisos breves en la parte inferior (sustituye a alert(), que en móvil es muy intrusivo). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly current = signal<Toast | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(text: string, error = false) {
    clearTimeout(this.timer);
    this.current.set({ text, error });
    this.timer = setTimeout(() => this.current.set(null), error ? 4000 : 2000);
  }

  error(text: string) {
    this.show(text, true);
  }
}
