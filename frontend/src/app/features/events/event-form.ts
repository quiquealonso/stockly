import { FormBuilder, Validators } from '@angular/forms';
import { StockEventRequest } from '../../core/models';

/** Hoy en 'YYYY-MM-DD' (hora local), para el <input type="date">. */
export function todayString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Formulario de evento, compartido por el alta (lista) y la edición (ficha). */
export function eventForm(fb: FormBuilder) {
  return fb.group({
    name: fb.nonNullable.control('', [Validators.required, Validators.maxLength(120)]),
    eventDate: fb.nonNullable.control(todayString(), Validators.required),
    guests: fb.control<number | null>(null, Validators.min(0)),
    notes: fb.nonNullable.control('', Validators.maxLength(500)),
  });
}

export type EventFormGroup = ReturnType<typeof eventForm>;

export function eventRequest(form: EventFormGroup): StockEventRequest {
  const { name, eventDate, guests, notes } = form.getRawValue();
  return { name, eventDate, guests: guests ?? null, notes: notes || null };
}
