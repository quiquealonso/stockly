import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { DragScroll } from '../../core/drag-scroll.directive';
import { Category, Product, Supplier, UNIT_LABELS, UNIT_SHORT } from '../../core/models';
import { ProductEditor } from '../../core/product-editor.service';
import { ToastService } from '../../core/toast.service';
import { ProductIcon } from './product-icon';

/** Cómo se organizan los chips del stock (lo elige cada dispositivo). */
type GroupBy = 'category' | 'supplier';
const GROUP_BY_KEY = 'aletes.stock.agrupar';
/** Chip "Sin proveedor". */
const NO_SUPPLIER = 0;

function readGroupBy(): GroupBy {
  try {
    return localStorage.getItem(GROUP_BY_KEY) === 'supplier' ? 'supplier' : 'category';
  } catch {
    return 'category';
  }
}

@Component({
  selector: 'app-stock-page',
  imports: [RouterLink, DecimalPipe, DragScroll, ProductIcon],
  templateUrl: './stock-page.html',
  styleUrl: './stock-page.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class StockPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly editor = inject(ProductEditor);

  protected readonly unitShort = UNIT_SHORT;
  protected readonly unitLabels = UNIT_LABELS;
  protected readonly categories = signal<Category[]>([]);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly groupBy = signal<GroupBy>(readGroupBy());
  /** Chip seleccionado: id de categoría o de proveedor (0 = sin proveedor); null = todos. */
  protected readonly selectedGroup = signal<number | null>(null);
  protected readonly noSupplier = NO_SUPPLIER;
  protected readonly onlyLow = signal(false);
  protected readonly search = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Productos con un ajuste en curso (evita dobles toques). */
  protected readonly busy = signal<ReadonlySet<number>>(new Set());
  /** Producto abierto en la hoja de ajuste. */
  private readonly selectedId = signal<number | null>(null);

  protected readonly selected = computed(
    () => this.products().find((p) => p.id === this.selectedId()) ?? null,
  );

  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.products().filter(
      (p) =>
        (this.selectedGroup() === null || this.inGroup(p, this.selectedGroup()!)) &&
        (!this.onlyLow() || p.lowStock) &&
        (!term || p.name.toLowerCase().includes(term)),
    );
  });

  protected readonly lowCount = computed(() => this.products().filter((p) => p.lowStock).length);

  constructor() {
    // Tras crear/editar/borrar un producto en el diálogo, recargamos.
    this.editor.changed.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  ngOnInit() {
    this.load();
  }

  protected editProduct(product: Product) {
    this.close();
    this.editor.edit(product.id);
  }

  protected load() {
    this.loading.set(true);
    this.api.getCategories().subscribe({
      next: (c) => this.categories.set(c),
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.api.getSuppliers().subscribe({
      next: (s) => this.suppliers.set(s),
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.api.getProducts().subscribe({
      next: (p) => {
        this.products.set(p);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected setGroupBy(value: GroupBy) {
    this.groupBy.set(value);
    this.selectedGroup.set(null);
    try {
      localStorage.setItem(GROUP_BY_KEY, value);
    } catch {
      // Sin almacenamiento (modo privado): solo dura esta sesión.
    }
  }

  /** ¿Está el producto en ese grupo? Por proveedores puede estar en varios (o en «sin proveedor»). */
  private inGroup(p: Product, groupId: number) {
    if (this.groupBy() === 'category') return p.categoryId === groupId;
    return groupId === NO_SUPPLIER ? !p.supplierIds.length : p.supplierIds.includes(groupId);
  }

  /** Nombres de los proveedores del producto ("Bebidas Sur, Frescos Norte"). */
  protected supplierNames(p: Product) {
    return p.suppliers.map((s) => s.name).join(', ');
  }

  protected countFor(groupId: number) {
    return this.products().filter((p) => this.inGroup(p, groupId)).length;
  }

  protected open(product: Product) {
    this.selectedId.set(product.id);
  }

  protected close() {
    this.selectedId.set(null);
  }

  protected adjust(product: Product, delta: number, onDone?: () => void) {
    if (!delta || this.busy().has(product.id)) return;
    this.setBusy(product.id, true);
    this.api.adjustStock(product.id, delta).subscribe({
      next: (updated) => {
        this.products.update((list) =>
          list.map((p) =>
            p.id === updated.id
              ? { ...p, quantity: updated.quantity, lowStock: updated.lowStock }
              : p,
          ),
        );
        this.setBusy(product.id, false);
        onDone?.();
      },
      error: (e) => {
        this.setBusy(product.id, false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected adjustFromInput(product: Product, input: HTMLInputElement, sign: 1 | -1) {
    const value = Number(input.value.replace(',', '.'));
    if (!value || value < 0) {
      this.toast.error('Introduce una cantidad mayor que 0');
      input.focus();
      return;
    }
    this.adjust(product, sign * value, () => {
      this.toast.show(`${sign > 0 ? 'Entrada' : 'Salida'} de ${value} ${UNIT_SHORT[product.unit]} · ${product.name}`);
      this.close();
    });
  }

  private setBusy(id: number, on: boolean) {
    this.busy.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
