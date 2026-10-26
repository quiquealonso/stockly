import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { Product, Supplier, UNIT_SHORT } from '../../core/models';
import { ProductEditor } from '../../core/product-editor.service';
import { ToastService } from '../../core/toast.service';

/** Alta/edición de un pedido favorito: nombre + cantidad habitual de cada producto. */
@Component({
  selector: 'app-order-form',
  imports: [RouterLink],
  templateUrl: './order-form.html',
  host: { '(document:keydown.escape)': 'onEscape()' },
  styles: `
    .lines {
      padding: 0;
      overflow: hidden;
    }
    .line {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.45rem 1rem;

      &.on {
        background: var(--accent-soft);
      }
    }
    .line-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;

      .name {
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    .line-qty {
      flex: none;
      display: flex;
      align-items: center;
      gap: 0.35rem;

      input {
        width: 84px;
        text-align: center;
        font-weight: 600;
      }
      span {
        width: 2.2rem;
      }
    }
    .show-all {
      margin: 0.25rem 0 0.5rem;
    }
  `,
})
export class OrderForm implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly editor = inject(ProductEditor);

  /** Parámetros de ruta: `:id` del proveedor y `:orderId` (vacío al crear). */
  readonly id = input.required<string>();
  readonly orderId = input<string>();

  protected readonly unitShort = UNIT_SHORT;
  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly allProducts = signal<Product[]>([]);
  protected readonly name = signal('');
  /** Cantidad por producto; vacía o 0 = no entra en el pedido. */
  protected readonly qty = signal<Record<number, string>>({});
  protected readonly showAll = signal(false);
  /** Productos que ya estaban en el pedido al abrirlo (se muestran aunque sean de otro proveedor). */
  private readonly savedIds = signal<ReadonlySet<number>>(new Set());
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  /** Productos del proveedor + los que ya estén en el pedido (o todos, si se pide). */
  protected readonly candidates = computed(() => {
    const supplierId = Number(this.id());
    const saved = this.savedIds();
    return this.allProducts().filter(
      (p) => this.showAll() || p.supplierIds.includes(supplierId) || saved.has(p.id),
    );
  });

  protected readonly items = computed(() =>
    Object.entries(this.qty())
      .map(([productId, value]) => ({ productId: Number(productId), quantity: parseAmount(value) }))
      .filter((i) => i.quantity > 0),
  );

  constructor() {
    // Un producto creado desde aquí aparece en la lista al momento.
    this.editor.changed
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.api.getProducts().subscribe((p) => this.allProducts.set(p)));
  }

  ngOnInit() {
    const supplierId = Number(this.id());
    this.api.getSupplier(supplierId).subscribe({
      next: (s) => this.supplier.set(s),
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.api.getProducts().subscribe({
      next: (p) => {
        this.allProducts.set(p);
        // Sin productos asignados al proveedor, mostramos todos directamente.
        if (!p.some((x) => x.supplierIds.includes(supplierId))) this.showAll.set(true);
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
    const orderId = Number(this.orderId());
    if (orderId) {
      this.api.getFavoriteOrder(orderId).subscribe({
        next: (o) => {
          this.name.set(o.name);
          this.qty.set(Object.fromEntries(o.items.map((i) => [i.productId, String(i.quantity)])));
          this.savedIds.set(new Set(o.items.map((i) => i.productId)));
        },
        error: (e) => this.error.set(errorMessage(e)),
      });
    }
  }

  /** Escape vuelve a la ficha, salvo que haya un diálogo o confirmación encima. */
  protected onEscape() {
    if (this.editor.current() || this.confirm.current()) return;
    this.router.navigate(['/proveedores', this.id()]);
  }

  /** Los que NO son de este proveedor llevan detrás de quién son ("· Bebidas Sur"). */
  protected otherSuppliers(p: Product) {
    const id = Number(this.id());
    return p.supplierIds.includes(id) ? '' : p.suppliers.map((s) => s.name).join(', ');
  }

  protected inOrder(productId: number) {
    return parseAmount(this.qty()[productId]) > 0;
  }

  protected setQty(productId: number, value: string) {
    this.qty.update((q) => ({ ...q, [productId]: value }));
  }

  protected save() {
    const name = this.name().trim();
    if (!name) {
      this.toast.error('Ponle un nombre al pedido');
      return;
    }
    if (!this.items().length) {
      this.toast.error('Pon cantidad al menos a un producto');
      return;
    }
    const orderId = Number(this.orderId()) || null;
    this.saving.set(true);
    this.api
      .saveFavoriteOrder(orderId, { supplierId: Number(this.id()), name, items: this.items() })
      .subscribe({
        next: () => {
          this.toast.show(orderId ? 'Pedido guardado' : 'Pedido favorito creado');
          this.router.navigate(['/proveedores', this.id()]);
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(errorMessage(e));
        },
      });
  }

  protected async remove() {
    const orderId = Number(this.orderId());
    if (!orderId) return;
    const ok = await this.confirm.ask({
      message: `¿Borrar el pedido favorito "${this.name()}"?`,
      ok: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    this.saving.set(true);
    this.api.deleteFavoriteOrder(orderId).subscribe({
      next: () => {
        this.toast.show('Pedido borrado');
        this.router.navigate(['/proveedores', this.id()]);
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }
}

function parseAmount(value: string | undefined): number {
  const n = Number((value ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
