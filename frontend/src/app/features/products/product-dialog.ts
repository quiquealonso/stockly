import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { Dialog } from '../../core/dialog';
import { Category, Supplier, Unit, UNIT_LABELS } from '../../core/models';
import { ProductEditor } from '../../core/product-editor.service';
import { ToastService } from '../../core/toast.service';

/** Alta, edición y borrado de un producto. Lo abre `ProductEditor` desde cualquier pantalla. */
@Component({
  selector: 'app-product-dialog',
  imports: [ReactiveFormsModule, Dialog],
  templateUrl: './product-dialog.html',
  styles: `
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .field-label {
      font-size: 0.9rem;
      font-weight: 500;
    }
    .supplier-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .chip {
      min-height: 38px;
      padding: 0.3rem 0.85rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface);
      color: var(--text);
      font: inherit;
      font-size: 0.9rem;
      cursor: pointer;

      &.selected {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }
    }
  `,
})
export class ProductDialog implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly editor = inject(ProductEditor);

  /** Petición con la que se abrió (fija mientras el diálogo vive). */
  protected readonly request = this.editor.current()!;
  protected readonly units = Object.entries(UNIT_LABELS) as [Unit, string][];
  protected readonly categories = signal<Category[]>([]);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    categoryId: [0, [Validators.required, Validators.min(1)]],
    supplierIds: [[] as number[]],
    unit: ['UNIT' as Unit, Validators.required],
    quantity: [0, [Validators.required, Validators.min(0)]],
    minStock: [0, [Validators.required, Validators.min(0)]],
    active: [true],
  });

  ngOnInit() {
    const id = this.request.id;
    this.api.getCategories().subscribe({
      next: (c) => {
        this.categories.set(c);
        // Al crear: la categoría de la ficha desde la que se abre, o la única que haya.
        const preset = this.request.categoryId ?? (c.length === 1 ? c[0].id : null);
        if (!id && preset) this.form.controls.categoryId.setValue(preset);
      },
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.api.getSuppliers().subscribe({
      next: (s) => this.suppliers.set(s),
      error: (e) => this.error.set(errorMessage(e)),
    });
    if (!id && this.request.supplierId) {
      this.form.controls.supplierIds.setValue([this.request.supplierId]);
    }
    if (id) {
      this.api.getProduct(id).subscribe({
        next: (p) =>
          this.form.setValue({
            name: p.name,
            categoryId: p.categoryId,
            supplierIds: p.supplierIds,
            unit: p.unit,
            quantity: p.quantity,
            minStock: p.minStock,
            active: p.active,
          }),
        error: (e) => this.error.set(errorMessage(e)),
      });
    }
  }

  protected toggleSupplier(id: number) {
    const ids = this.form.controls.supplierIds.value;
    this.form.controls.supplierIds.setValue(
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  protected save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.request.id;
    const body = this.form.getRawValue();
    const req = id ? this.api.updateProduct(id, body) : this.api.createProduct(body);
    this.saving.set(true);
    req.subscribe({
      next: () => {
        this.toast.show(id ? 'Producto guardado' : 'Producto creado');
        this.done();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }

  protected async remove() {
    const id = this.request.id;
    if (!id) return;
    const ok = await this.confirm.ask({
      message: `¿Borrar "${this.form.controls.name.value}"?`,
      ok: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    this.saving.set(true);
    this.api.deleteProduct(id).subscribe({
      next: () => {
        this.toast.show('Producto borrado');
        this.done();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errorMessage(e));
      },
    });
  }

  private done() {
    this.editor.close();
    this.editor.changed.next();
  }
}
