import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { Dialog } from '../../core/dialog';
import { Category, Product, UNIT_SHORT } from '../../core/models';
import { ProductEditor } from '../../core/product-editor.service';
import { ToastService } from '../../core/toast.service';
import { ProductPicker } from '../products/product-picker';

/** Ficha de una categoría: sus productos, editar/borrar y traer productos de otras. */
@Component({
  selector: 'app-category-detail',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe, Dialog, ProductPicker],
  templateUrl: './category-detail.html',
})
export class CategoryDetail implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly editor = inject(ProductEditor);

  /** Parámetro de ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly unitShort = UNIT_SHORT;
  protected readonly category = signal<Category | null>(null);
  /** Todos los productos (para traerlos); los de la categoría salen de aquí. */
  protected readonly allProducts = signal<Product[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly sheet = signal<'edit' | 'assign' | null>(null);

  protected readonly products = computed(() =>
    this.allProducts().filter((p) => p.categoryId === this.categoryId()),
  );
  /** Candidatos a traer: los de otras categorías (un producto siempre tiene categoría). */
  protected readonly others = computed(() =>
    this.allProducts().filter((p) => p.categoryId !== this.categoryId()),
  );
  protected readonly assignSelected = signal<ReadonlySet<number>>(new Set());

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(255)],
  });

  protected supplierNames(p: Product) {
    return p.suppliers.map((s) => s.name).join(', ');
  }

  protected categoryId() {
    return Number(this.id());
  }

  constructor() {
    // Tras crear/editar/borrar un producto en el diálogo, recargamos.
    this.editor.changed.pipe(takeUntilDestroyed()).subscribe(() => this.loadProducts());
  }

  ngOnInit() {
    this.api.getCategory(this.categoryId()).subscribe({
      next: (c) => this.category.set(c),
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

  protected closeSheet() {
    this.sheet.set(null);
  }

  // --- Editar / borrar categoría ---

  protected startEdit() {
    const c = this.category();
    if (!c) return;
    this.form.setValue({ name: c.name, description: c.description ?? '' });
    this.sheet.set('edit');
  }

  protected saveCategory() {
    if (this.form.invalid) return;
    const { name, description } = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .updateCategory(this.categoryId(), { name, description: description || null })
      .subscribe({
        next: (c) => {
          this.saving.set(false);
          this.category.set(c);
          this.toast.show('Categoría guardada');
          this.closeSheet();
        },
        error: (e) => {
          this.saving.set(false);
          this.toast.error(errorMessage(e));
        },
      });
  }

  protected async removeCategory() {
    const c = this.category();
    if (!c) return;
    const ok = await this.confirm.ask({
      message: `¿Borrar la categoría "${c.name}"?`,
      ok: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    this.api.deleteCategory(c.id).subscribe({
      next: () => {
        this.toast.show('Categoría borrada');
        this.router.navigate(['/categorias']);
      },
      error: (e) => this.toast.error(errorMessage(e)),
    });
  }

  // --- Traer productos de otras categorías ---

  protected startAssign() {
    this.assignSelected.set(new Set());
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
    const ids = [...this.assignSelected()];
    if (!ids.length) {
      this.closeSheet();
      return;
    }
    this.saving.set(true);
    this.api.moveProductsToCategory(this.categoryId(), ids).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show(`${ids.length} productos movidos a ${this.category()?.name}`);
        this.closeSheet();
        this.loadProducts();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
