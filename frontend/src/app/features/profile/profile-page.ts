import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, errorMessage } from '../../core/api.service';
import { CompanyService } from '../../core/company.service';
import { Dialog } from '../../core/dialog';
import { SupabaseService } from '../../core/supabase.service';
import { ToastService } from '../../core/toast.service';

/** Lado máximo del logo guardado (px): de sobra para la cabecera y ligero en la BBDD. */
const LOGO_MAX = 256;

/** Reduce la imagen elegida y la devuelve como data URL (PNG; JPEG si el PNG pesa mucho). */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, LOGO_MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = canvas.toDataURL('image/png');
      resolve(png.length < 300_000 ? png : canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se ha podido leer la imagen'));
    };
    img.src = url;
  });
}

/** Perfil de la empresa: datos básicos y logo de la cabecera (tabla companies). */
@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, Dialog],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  private readonly api = inject(ApiService);
  private readonly companies = inject(CompanyService);
  private readonly toast = inject(ToastService);

  protected readonly company = this.companies.company;
  protected readonly userEmail = inject(SupabaseService).email;
  protected readonly editOpen = signal(false);
  protected readonly saving = signal(false);
  /** Logo en edición (data URL o null = sin logo). */
  protected readonly logo = signal<string | null>(null);

  /** Dirección en una línea: "C/ Mayor 1, 46001 Valencia (Valencia), España". */
  protected readonly fullAddress = computed(() => {
    const c = this.company();
    if (!c) return '';
    const place = [c.postalCode, c.city].filter(Boolean).join(' ');
    const province = c.province && c.province !== c.city ? `(${c.province})` : '';
    return [c.address, [place, province].filter(Boolean).join(' '), c.country]
      .filter(Boolean)
      .join(', ');
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    legalName: ['', Validators.maxLength(160)],
    taxId: ['', Validators.maxLength(20)],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    phone: ['', Validators.maxLength(40)],
    address: ['', Validators.maxLength(255)],
    postalCode: ['', Validators.maxLength(10)],
    city: ['', Validators.maxLength(80)],
    province: ['', Validators.maxLength(80)],
    country: ['España', Validators.maxLength(80)],
    website: ['', Validators.maxLength(255)],
  });

  protected startEdit() {
    const c = this.company();
    if (!c) return;
    this.form.reset({
      name: c.name,
      legalName: c.legalName ?? '',
      taxId: c.taxId ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      address: c.address ?? '',
      postalCode: c.postalCode ?? '',
      city: c.city ?? '',
      province: c.province ?? '',
      country: c.country,
      website: c.website ?? '',
    });
    this.logo.set(c.logo);
    this.editOpen.set(true);
  }

  protected async pickLogo(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.error('Elige una imagen');
      return;
    }
    try {
      this.logo.set(await resizeImage(file));
    } catch (e) {
      this.toast.error(errorMessage(e));
    }
  }

  protected save() {
    const c = this.company();
    if (!c || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .updateCompany(c.id, {
        name: v.name,
        legalName: v.legalName,
        taxId: v.taxId,
        email: v.email,
        phone: v.phone,
        address: v.address,
        postalCode: v.postalCode,
        city: v.city,
        province: v.province,
        country: v.country,
        website: v.website,
        logo: this.logo(),
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.companies.set(updated);
          this.toast.show('Perfil guardado');
          this.editOpen.set(false);
        },
        error: (e) => {
          this.saving.set(false);
          this.toast.error(errorMessage(e));
        },
      });
  }

  /** Enlace a la web aunque se haya escrito sin http(s)://. */
  protected websiteHref(url: string) {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }
}
