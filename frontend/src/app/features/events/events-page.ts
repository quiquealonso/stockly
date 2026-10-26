import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { Dialog } from '../../core/dialog';
import { StockEvent } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { eventForm, eventRequest, todayString } from './event-form';

/** Lista de eventos (los más recientes primero) y alta en diálogo. */
@Component({
  selector: 'app-events-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, Dialog],
  templateUrl: './events-page.html',
  styles: `
    .ev-list {
      padding: 0;
      overflow: hidden;
    }
    .ev {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 64px;
      padding: 0.5rem 1rem;
      color: inherit;
      text-decoration: none;

      &:hover {
        background: var(--hover);
      }
    }
    .ev-date {
      flex: none;
      width: 3rem;
      text-align: center;
      line-height: 1.1;

      strong {
        display: block;
        font-size: 1.3rem;
      }
      span {
        font-size: 0.75rem;
        color: var(--muted);
        text-transform: uppercase;
      }
    }
    .ev-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;

      .strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    .chevron {
      color: var(--muted);
      font-size: 1.3rem;
    }
  `,
})
export class EventsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly events = signal<(StockEvent & { itemCount: number })[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly dialogOpen = signal(false);

  protected readonly form = eventForm(inject(FormBuilder));

  ngOnInit() {
    this.api.getEvents().subscribe({
      next: (e) => {
        this.events.set(e);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected openNew() {
    this.form.reset({ name: '', eventDate: todayString(), guests: null, notes: '' });
    this.dialogOpen.set(true);
  }

  protected save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.createEvent(eventRequest(this.form)).subscribe({
      next: (e) => {
        this.toast.show('Evento creado');
        // Directo a su ficha, para apuntar el consumo.
        this.router.navigate(['/eventos', e.id]);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(errorMessage(e));
      },
    });
  }
}
