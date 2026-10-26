import { Component, inject, input, output } from '@angular/core';
import { ConfirmService } from './confirm.service';

/**
 * Diálogo común de la app: hoja inferior en móvil, ventana centrada en escritorio.
 * Se cierra con la ✕, tocando fuera o con Escape. El contenido va proyectado.
 */
@Component({
  selector: 'app-dialog',
  template: `
    <div class="sheet-backdrop" (click)="closed.emit()">
      <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (click)="$event.stopPropagation()"
      >
        <div class="dialog-head">
          <h2>{{ title() }}</h2>
          <button type="button" class="dialog-close" aria-label="Cerrar" (click)="closed.emit()">✕</button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class Dialog {
  private readonly confirm = inject(ConfirmService);

  readonly title = input.required<string>();
  readonly closed = output<void>();

  protected onEscape() {
    // Con una confirmación abierta encima, Escape solo cierra la confirmación.
    if (!this.confirm.current()) this.closed.emit();
  }
}
