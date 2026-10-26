import { Component, computed, input, output, signal } from '@angular/core';
import { Product } from '../../core/models';

/** Valor del filtro para "Sin proveedor". */
const NONE = 0;

/**
 * Lista de productos con casillas, buscador y filtro por categoría o por proveedor.
 * Se usa en los diálogos de «Asignar» de proveedores y categorías.
 */
@Component({
  selector: 'app-product-picker',
  template: `
    <div class="picker-filters">
      <input
        type="search"
        placeholder="Buscar producto…"
        [value]="search()"
        (input)="search.set($any($event.target).value)"
      />
      <select
        [attr.aria-label]="filterBy() === 'category' ? 'Filtrar por categoría' : 'Filtrar por proveedor'"
        (change)="setFilter($any($event.target).value)"
      >
        <option value="">{{ filterBy() === 'category' ? 'Todas las categorías' : 'Todos los proveedores' }}</option>
        @for (o of options(); track o.id) {
          <option [value]="o.id">{{ o.name }}</option>
        }
      </select>
    </div>
    <ul class="list pick">
      @for (p of visible(); track p.id) {
        <li>
          <label class="check">
            <input
              type="checkbox"
              [checked]="selected().has(p.id)"
              (change)="toggle.emit(p.id)"
            />
            <span class="pick-name">
              {{ p.name }}
              <span class="muted small">{{ p.category?.name }} · {{ supplierNames(p) }}</span>
            </span>
          </label>
        </li>
      } @empty {
        <li class="empty">No hay productos con estos filtros.</li>
      }
    </ul>
  `,
  styles: `
    .picker-filters {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      margin-bottom: 0.5rem;

      input,
      select {
        min-width: 0;
      }
      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }
    .pick {
      margin-bottom: 0.75rem;

      .check {
        display: flex;
        width: 100%;
        padding: 0.25rem;
      }
    }
    .pick-name {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
  `,
})
export class ProductPicker {
  readonly products = input.required<Product[]>();
  readonly selected = input.required<ReadonlySet<number>>();
  readonly filterBy = input.required<'category' | 'supplier'>();
  readonly toggle = output<number>();

  protected readonly search = signal('');
  /** null = sin filtro; con proveedores, 0 = sin proveedor. */
  private readonly filter = signal<number | null>(null);

  /** Opciones del filtro, sacadas de los propios productos. */
  protected readonly options = computed(() => {
    const byId = new Map<number, string>();
    for (const p of this.products()) {
      if (this.filterBy() === 'category') {
        if (p.category) byId.set(p.category.id, p.category.name);
      } else {
        if (!p.suppliers.length) byId.set(NONE, 'Sin proveedor');
        for (const s of p.suppliers) byId.set(s.id, s.name);
      }
    }
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    const filter = this.filter();
    return this.products().filter(
      (p) =>
        (!term || p.name.toLowerCase().includes(term)) &&
        (filter === null ||
          (this.filterBy() === 'category'
            ? p.categoryId === filter
            : filter === NONE
              ? !p.suppliers.length
              : p.supplierIds.includes(filter))),
    );
  });

  protected supplierNames(p: Product) {
    return p.suppliers.length ? p.suppliers.map((s) => s.name).join(', ') : 'sin proveedor';
  }

  protected setFilter(value: string) {
    this.filter.set(value === '' ? null : Number(value));
  }
}
