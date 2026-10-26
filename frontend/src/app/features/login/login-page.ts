import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../../core/api.service';
import { SupabaseService } from '../../core/supabase.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  template: `
    <form class="card form login" [formGroup]="form" (ngSubmit)="submit()">
      <h1>Stockly</h1>
      <p class="muted">Control de stock · acceso del personal</p>
      @if (error()) {
        <div class="alert">{{ error() }}</div>
      }
      <label>
        Email
        <input type="email" inputmode="email" formControlName="email" autocomplete="username" autocapitalize="off" enterkeyhint="next" />
      </label>
      <label>
        Contraseña
        <input type="password" formControlName="password" autocomplete="current-password" enterkeyhint="go" />
      </label>
      <button type="submit" class="btn primary block" [disabled]="form.invalid || loading()">
        {{ loading() ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  `,
  styles: `
    .login {
      max-width: 380px;
      margin: calc(8vh + var(--safe-top)) auto 0;
    }
  `,
})
export class LoginPage {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.supabase.login(email, password);
      await this.router.navigate(['/stock']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
