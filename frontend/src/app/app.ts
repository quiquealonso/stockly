import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CompanyService } from './core/company.service';
import { ConfirmService } from './core/confirm.service';
import { ProductEditor } from './core/product-editor.service';
import { ProductDialog } from './features/products/product-dialog';
import { SupabaseService } from './core/supabase.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ProductDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: { '(document:keydown.escape)': 'confirm.current() && confirm.answer(false)' },
})
export class App {
  protected readonly supabase = inject(SupabaseService);
  protected readonly toast = inject(ToastService);
  protected readonly confirm = inject(ConfirmService);
  protected readonly productEditor = inject(ProductEditor);
  protected readonly company = inject(CompanyService).company;
  private readonly router = inject(Router);

  protected async logout() {
    if (!(await this.confirm.ask({ message: '¿Cerrar sesión?', ok: 'Salir' }))) return;
    await this.supabase.logout();
    await this.router.navigate(['/login']);
  }
}
