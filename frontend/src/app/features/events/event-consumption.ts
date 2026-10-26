import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { Category, Product, StockEvent, UNIT_SHORT } from '../../core/models';
import { ProductEditor } from '../../core/product-editor.service';
import { ToastService } from '../../core/toast.service';

/**
 * Apuntar el consumo de un evento: cantidad por producto (vacío = no se consumió).
 * Página fija con forma de diálogo, como el pedido favorito. Solo guarda: descontar
 * del stock se hace desde la ficha del evento.
 */
@Component({
  selector: 'app-event-consumption',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './event-consumption.html',
  host: { '(document:keydown.escape)': 'onEscape()' },
  styles: `
    .tools {
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
    .only-marked {
      margin-bottom: 0.25rem;
    }
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
        background: var(--danger-soft);
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
  `,
})
export class EventConsumption implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly editor = inject(ProductEditor);

  /** Parámetro de ruta `:id` del evento. */
  readonly id = input.required<string>();

  protected readonly unitShort = UNIT_SHORT;
  protected readonly event = signal<StockEvent | null>(null);
  protected readonly allProducts = signal<Product[]>([]);
  protected readonly categories = signal<Category[]>([]);
  /** Cantidad consumida por producto; vacía o 0 = no entra. */
  protected readonly qty = signal<Record<number, string>>({});
  protected readonly search = signal('');
  protected readonly categoryId = signal<number | null>(null);
  protected readonly onlyMarked = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    const cat = this.categoryId();
    const only = this.onlyMarked();
    return this.allProducts().filter(
      (p) =>
        (!term || p.name.toLowerCase().includes(term)) &&
        (cat === null || p.categoryId === cat) &&
        (!only || this.inEvent(p.id)),
    );
  });

  protected readonly items = computed(() =>
    Object.entries(this.qty())
      .map(([productId, value]) => ({ productId: Number(productId), quantity: parseAmount(value) }))
      .filter((i) => i.quantity > 0),
  );

  constructor() {
    // Un producto creado desde aquí aparece en la lista al momento.
    this.editor.changed.pipe(takeUntilDestroyed()).subscribe(() => this.loadProducts());
  }

  ngOnInit() {
    this.api.getEvent(Number(this.id())).subscribe({
      next: (e) => {
        if (e.appliedAt) {
          this.toast.error('Este evento ya se descontó: su consumo no se puede cambiar');
          this.router.navigate(['/eventos', e.id]);
          return;
        }
        this.event.set(e);
        this.qty.set(Object.fromEntries(e.items.map((i) => [i.productId, String(i.quantity)])));
        // Al editar un consumo ya apuntado, primero se ve lo apuntado.
        if (e.items.length) this.onlyMarked.set(true);
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.api.getCategories().subscribe({
      next: (c) => this.categories.set(c),
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.loadProducts();
  }

  private loadProducts() {
    this.api.getProducts().subscribe({
      next: (p) => this.allProducts.set(p),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  protected inEvent(productId: number) {
    return parseAmount(this.qty()[productId]) > 0;
  }

  /** Lo apuntado supera el stock actual (no se podrá descontar así). */
  protected exceeds(p: Product) {
    return parseAmount(this.qty()[p.id]) > p.quantity;
  }

  protected setQty(productId: number, value: string) {
    this.qty.update((q) => ({ ...q, [productId]: value }));
  }

  protected setCategory(value: string) {
    this.categoryId.set(value === '' ? null : Number(value));
  }

  protected back() {
    this.router.navigate(['/eventos', this.id()]);
  }

  /** Escape vuelve a la ficha, salvo que haya un diálogo o confirmación encima. */
  protected onEscape() {
    if (this.editor.current() || this.confirm.current()) return;
    this.back();
  }

  protected save() {
    this.saving.set(true);
    this.api.saveEventItems(Number(this.id()), this.items()).subscribe({
      next: () => {
        this.toast.show('Consumo guardado');
        this.back();
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
