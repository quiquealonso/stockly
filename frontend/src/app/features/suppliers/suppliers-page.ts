import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { Dialog } from '../../core/dialog';
import { Supplier } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-suppliers-page',
  imports: [ReactiveFormsModule, RouterLink, Dialog],
  templateUrl: './suppliers-page.html',
  styles: `
    .sup-list {
      padding: 0;
      overflow: hidden;
    }
    .sup {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 60px;
      padding: 0.5rem 1rem;
      color: inherit;
      text-decoration: none;

      &:hover {
        background: var(--hover);
      }
    }
    .sup-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .chevron {
      color: var(--muted);
      font-size: 1.3rem;
    }
  `,
})
export class SuppliersPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly dialogOpen = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    phone: ['', Validators.maxLength(40)],
    notes: ['', Validators.maxLength(500)],
  });

  ngOnInit() {
    this.api.getSuppliers().subscribe({
      next: (s) => {
        this.suppliers.set(s);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected openNew() {
    this.form.reset();
    this.dialogOpen.set(true);
  }

  protected save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.createSupplier(this.form.getRawValue()).subscribe({
      next: (s) => {
        this.toast.show('Proveedor creado');
        // Directo a su ficha, para asignarle productos y pedidos.
        this.router.navigate(['/proveedores', s.id]);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
