import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { Dialog } from '../../core/dialog';
import { FavoriteOrder, Product, Supplier, UNIT_SHORT } from '../../core/models';
import { ProductEditor } from '../../core/product-editor.service';
import { ToastService } from '../../core/toast.service';
import { ProductPicker } from '../products/product-picker';

/** Diálogo abierto en la ficha del proveedor. */
type Sheet = 'edit' | 'assign' | 'order' | null;

@Component({
  selector: 'app-supplier-detail',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe, Dialog, ProductPicker],
  templateUrl: './supplier-detail.html',
  styleUrl: './supplier-detail.scss',
})
export class SupplierDetail implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly editor = inject(ProductEditor);

  /** Parámetro de ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly unitShort = UNIT_SHORT;
  protected readonly supplier = signal<Supplier | null>(null);
  /** Todos los productos (para asignarlos); los del proveedor salen de aquí. */
  protected readonly allProducts = signal<Product[]>([]);
  protected readonly orders = signal<FavoriteOrder[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly sheet = signal<Sheet>(null);

  protected readonly products = computed(() =>
    this.allProducts().filter((p) => p.supplierIds.includes(this.supplierId())),
  );

  // --- Asignar productos ---
  protected readonly assignSelected = signal<ReadonlySet<number>>(new Set());

  // --- Pedido favorito abierto ---
  protected readonly openOrder = signal<FavoriteOrder | null>(null);
  /** Cantidades de esta vez (por defecto, las guardadas en el pedido). */
  protected readonly orderQty = signal<Record<number, string>>({});
  protected readonly orderLines = computed(() => {
    const qty = this.orderQty();
    return (this.openOrder()?.items ?? [])
      .filter((i) => i.product)
      .map((i) => ({ ...i, product: i.product!, amount: parseAmount(qty[i.productId]) }));
  });
  protected readonly orderReady = computed(() => this.orderLines().filter((l) => l.amount > 0));

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    phone: ['', Validators.maxLength(40)],
    notes: ['', Validators.maxLength(500)],
  });

  protected supplierId() {
    return Number(this.id());
  }

  constructor() {
    // Tras crear/editar/borrar un producto en el diálogo, recargamos.
    this.editor.changed.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  ngOnInit() {
    this.load();
  }

  private load() {
    const id = this.supplierId();
    this.api.getSupplier(id).subscribe({
      next: (s) => this.supplier.set(s),
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.api.getProducts().subscribe({
      next: (p) => this.allProducts.set(p),
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.api.getFavoriteOrders(id).subscribe({
      next: (o) => this.orders.set(o),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  protected closeSheet() {
    this.sheet.set(null);
    this.openOrder.set(null);
  }

  // --- Editar / borrar proveedor ---

  protected startEdit() {
    const s = this.supplier();
    if (!s) return;
    this.form.setValue({ name: s.name, phone: s.phone ?? '', notes: s.notes ?? '' });
    this.sheet.set('edit');
  }

  protected saveSupplier() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.updateSupplier(this.supplierId(), this.form.getRawValue()).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.supplier.update((prev) => ({ ...prev!, ...s }));
        this.toast.show('Proveedor guardado');
        this.closeSheet();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected async removeSupplier() {
    const s = this.supplier();
    if (!s) return;
    const ok = await this.confirm.ask({
      message: `¿Borrar "${s.name}"? Sus productos quedarán sin proveedor y se borrarán sus pedidos favoritos.`,
      ok: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    this.api.deleteSupplier(s.id).subscribe({
      next: () => {
        this.toast.show('Proveedor borrado');
        this.router.navigate(['/proveedores']);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  // --- Asignar productos ---

  protected startAssign() {
    this.assignSelected.set(new Set(this.products().map((p) => p.id)));
    this.sheet.set('assign');
  }

  protected toggleAssign(id: number) {
    this.assignSelected.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected saveAssign() {
    const id = this.supplierId();
    const ids = [...this.assignSelected()];
    this.saving.set(true);
    this.api.setSupplierProducts(id, ids).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show('Productos asignados');
        this.closeSheet();
        // Recarga para tener también los nombres de los demás proveedores al día.
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  // --- Pedido favorito ---

  protected showOrder(order: FavoriteOrder) {
    this.openOrder.set(order);
    this.orderQty.set(
      Object.fromEntries(order.items.map((i) => [i.productId, String(i.quantity)])),
    );
    this.sheet.set('order');
  }

  protected setQty(productId: number, value: string) {
    this.orderQty.update((q) => ({ ...q, [productId]: value }));
  }

  /** Copia la lista para mandarla al proveedor (WhatsApp, SMS…). */
  protected async copyOrder() {
    const order = this.openOrder();
    const lines = this.orderReady();
    if (!order || !lines.length) return;
    const text = [
      `Pedido ${order.name} · ${this.supplier()?.name ?? ''}`,
      ...lines.map((l) => `- ${l.product.name}: ${formatAmount(l.amount)} ${UNIT_SHORT[l.product.unit]}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      this.toast.show('Lista copiada');
    } catch {
      this.toast.error('No se ha podido copiar');
    }
  }

  protected async receiveOrder() {
    const lines = this.orderReady();
    if (!lines.length) return;
    const ok = await this.confirm.ask({
      message: `¿Sumar al stock los ${lines.length} productos de este pedido?`,
      ok: 'Sumar al stock',
    });
    if (!ok) return;
    this.saving.set(true);
    this.api
      .receiveOrder(
        lines.map((l) => ({ productId: l.productId, quantity: l.amount })),
        this.openOrder(),
      )
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          const byId = new Map(updated.map((p) => [p.id, p]));
          const patch = (p: Product) => {
            const u = byId.get(p.id);
            return u ? { ...p, quantity: u.quantity, lowStock: u.lowStock } : p;
          };
          this.allProducts.update((list) => list.map(patch));
          this.orders.update((list) =>
            list.map((o) => ({
              ...o,
              items: o.items.map((i) => ({ ...i, product: i.product && patch(i.product) })),
            })),
          );
          this.toast.show(`Stock actualizado · ${updated.length} productos`);
          this.closeSheet();
        },
        error: (e) => {
          this.saving.set(false);
          this.toast.error(errorMessage(e));
        },
      });
  }
}

function parseAmount(value: string | undefined): number {
  const n = Number((value ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function formatAmount(n: number): string {
  return n.toLocaleString('es-ES', { maximumFractionDigits: 3 });
}
