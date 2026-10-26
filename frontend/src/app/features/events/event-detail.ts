import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { ConfirmService } from '../../core/confirm.service';
import { Dialog } from '../../core/dialog';
import { StockEvent, UNIT_SHORT } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { eventForm, eventRequest } from './event-form';

/**
 * Ficha de un evento: datos, consumo apuntado (con ratio por comensal) y el botón de
 * descontarlo del stock (una sola vez; después el consumo queda fijo).
 */
@Component({
  selector: 'app-event-detail',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe, Dialog],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.scss',
})
export class EventDetail implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  /** Parámetro de ruta `:id`. */
  readonly id = input.required<string>();

  protected readonly unitShort = UNIT_SHORT;
  protected readonly event = signal<StockEvent | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editOpen = signal(false);

  protected readonly form = eventForm(inject(FormBuilder));

  /** Líneas sin stock suficiente (solo importa mientras no se ha descontado). */
  protected readonly shortCount = computed(() => {
    const e = this.event();
    if (!e || e.appliedAt) return 0;
    return e.items.filter((i) => i.product && i.product.quantity < i.quantity).length;
  });

  ngOnInit() {
    this.load();
  }

  private load() {
    this.api.getEvent(Number(this.id())).subscribe({
      next: (e) => this.event.set(e),
      error: (e) => this.error.set(errorMessage(e)),
    });
  }

  /** Cantidad por comensal, para comparar con otros eventos. */
  protected perGuest(quantity: number) {
    const guests = this.event()?.guests;
    return guests ? quantity / guests : null;
  }

  protected who(email: string | null) {
    return email?.split('@')[0] ?? '';
  }

  // --- Editar / borrar ---

  protected startEdit() {
    const e = this.event();
    if (!e) return;
    this.form.reset({
      name: e.name,
      eventDate: e.eventDate,
      guests: e.guests,
      notes: e.notes ?? '',
    });
    this.editOpen.set(true);
  }

  protected saveEvent() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.updateEvent(Number(this.id()), eventRequest(this.form)).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show('Evento guardado');
        this.editOpen.set(false);
        this.load();
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }

  protected async removeEvent() {
    const e = this.event();
    if (!e) return;
    const ok = await this.confirm.ask({
      message: e.appliedAt
        ? `¿Borrar "${e.name}"? El stock NO se devuelve; sus movimientos se quedan en Control.`
        : `¿Borrar "${e.name}" y su consumo apuntado?`,
      ok: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    this.api.deleteEvent(e.id).subscribe({
      next: () => {
        this.toast.show('Evento borrado');
        this.router.navigate(['/eventos']);
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }

  // --- Descontar del stock ---

  protected async consume() {
    const e = this.event();
    if (!e || e.appliedAt || !e.items.length) return;
    const ok = await this.confirm.ask({
      message: `¿Descontar del stock los ${e.items.length} productos de "${e.name}"? Después el consumo ya no se podrá cambiar.`,
      ok: 'Descontar',
      danger: true,
    });
    if (!ok) return;
    this.saving.set(true);
    this.api.consumeEvent(e.id).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.toast.show(`Stock descontado · ${updated.length} productos`);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }
}
