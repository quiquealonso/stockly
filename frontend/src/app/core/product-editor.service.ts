import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface ProductEditRequest {
  /** null = producto nuevo. */
  id: number | null;
  /** Proveedor preseleccionado al crear (desde la ficha de un proveedor). */
  supplierId?: number | null;
  /** Categoría preseleccionada al crear (desde la ficha de una categoría). */
  categoryId?: number | null;
}

/**
 * Abre el diálogo de producto desde cualquier pantalla (lo pinta `App`).
 * `changed` avisa a las pantallas para que recarguen tras guardar o borrar.
 */
@Injectable({ providedIn: 'root' })
export class ProductEditor {
  readonly current = signal<ProductEditRequest | null>(null);
  readonly changed = new Subject<void>();

  create(preset: { supplierId?: number | null; categoryId?: number | null } = {}) {
    this.current.set({ id: null, ...preset });
  }

  edit(id: number) {
    this.current.set({ id });
  }

  close() {
    this.current.set(null);
  }
}
