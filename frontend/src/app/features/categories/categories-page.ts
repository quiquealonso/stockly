import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { Dialog } from '../../core/dialog';
import { Category } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-categories-page',
  imports: [ReactiveFormsModule, RouterLink, Dialog],
  templateUrl: './categories-page.html',
  styles: `
    .cat-list {
      padding: 0;
      overflow: hidden;
    }
    .cat {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      min-height: 56px;
      padding: 0.5rem 1rem;
      color: inherit;
      text-decoration: none;

      &:hover {
        background: var(--hover);
      }
    }
    .chevron {
      color: var(--muted);
      font-size: 1.3rem;
    }
    .cat-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
  `,
})
export class CategoriesPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly categories = signal<Category[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly dialogOpen = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(255)],
  });

  ngOnInit() {
    this.load();
  }

  private load() {
    this.api.getCategories().subscribe({
      next: (c) => {
        this.categories.set(c);
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
    const { name, description } = this.form.getRawValue();
    this.saving.set(true);
    this.api.createCategory({ name, description: description || null }).subscribe({
      next: (c) => {
        this.toast.show('Categoría creada');
        // Directo a su ficha, para añadirle productos.
        this.router.navigate(['/categorias', c.id]);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
