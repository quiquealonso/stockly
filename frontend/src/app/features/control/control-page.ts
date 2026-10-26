import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, errorMessage } from '../../core/api.service';
import { DragScroll } from '../../core/drag-scroll.directive';
import { MOVEMENT_LABELS, MovementFilter, StockMovement, UNIT_SHORT } from '../../core/models';

type Direction = 'all' | 'in' | 'out';

/** Movimientos por página: suficiente para un vistazo sin traer todo el historial. */
const PAGE_SIZE = 100;

/** 'YYYY-MM-DD' en hora local (para el <input type="date">). */
function toDayString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Historial de entradas y salidas de stock: todo, del más reciente al más antiguo, paginado.
 * Los filtros (día opcional, producto, entradas/salidas) se aplican en la BBDD.
 */
@Component({
  selector: 'app-control-page',
  imports: [DatePipe, DecimalPipe, DragScroll, RouterLink],
  templateUrl: './control-page.html',
  styleUrl: './control-page.scss',
})
export class ControlPage implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly unitShort = UNIT_SHORT;
  protected readonly kindLabels = MOVEMENT_LABELS;
  protected readonly today = toDayString(new Date());
  /** Día filtrado ('YYYY-MM-DD'); vacío = todos los días. */
  protected readonly day = signal('');
  protected readonly direction = signal<Direction>('all');
  protected readonly search = signal('');
  protected readonly page = signal(0);
  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly total = signal(0);
  protected readonly counts = signal({ in: 0, out: 0 });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  /** Posición de la página actual: "101–200 de 345". */
  protected readonly rangeText = computed(() => {
    const total = this.total();
    if (!total) return '0';
    const first = this.page() * PAGE_SIZE + 1;
    return `${first}–${Math.min(first + PAGE_SIZE - 1, total)} de ${total}`;
  });

  /** Respuestas que llegan tarde (filtros cambiados mientras tanto) se descartan. */
  private requestId = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  ngOnInit() {
    this.load();
  }

  private filter(): MovementFilter {
    const f: MovementFilter = { search: this.search(), direction: this.direction() };
    if (this.day()) {
      f.from = parseDay(this.day());
      f.to = new Date(f.from);
      f.to.setDate(f.to.getDate() + 1);
    }
    return f;
  }

  /** Recarga la página actual (y los contadores, si `withCounts`). */
  protected load(withCounts = true) {
    const id = ++this.requestId;
    const filter = this.filter();
    this.loading.set(true);
    this.api
      .getMovementsPage(filter, this.page(), PAGE_SIZE)
      .then(({ rows, total }) => {
        if (id !== this.requestId) return;
        this.movements.set(rows);
        this.total.set(total);
        this.error.set(null);
      })
      .catch((e) => id === this.requestId && this.error.set(errorMessage(e)))
      .finally(() => id === this.requestId && this.loading.set(false));
    if (withCounts) {
      // Los contadores de los chips no dependen de la dirección elegida.
      this.api
        .countMovements({ ...filter, direction: 'all' })
        .then((c) => id === this.requestId && this.counts.set(c))
        .catch(() => undefined);
    }
  }

  /** Cualquier cambio de filtro vuelve a la primera página. */
  private reset(withCounts = true) {
    this.page.set(0);
    this.load(withCounts);
  }

  protected setDay(value: string) {
    this.day.set(value);
    this.reset();
  }

  protected shiftDay(days: number) {
    const d = parseDay(this.day() || this.today);
    d.setDate(d.getDate() + days);
    this.setDay(toDayString(d));
  }

  protected setDirection(value: Direction) {
    this.direction.set(value);
    this.reset(false);
  }

  protected onSearch(value: string) {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reset(), 300);
  }

  protected goTo(page: number) {
    if (page < 0 || page >= this.pages()) return;
    this.page.set(page);
    this.load(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Un grupo de toques que duró más de un minuto se muestra como rango (14:08–14:10). */
  protected isRange(m: StockMovement) {
    return m.updatedAt.getTime() - m.createdAt.getTime() >= 60_000;
  }

  /** Cabecera de día al cambiar de fecha entre movimientos consecutivos. */
  protected newDay(index: number) {
    const list = this.movements();
    return index === 0 || toDayString(list[index].updatedAt) !== toDayString(list[index - 1].updatedAt);
  }

  /** Nombre corto de quien lo hizo (parte del email antes de la @). */
  protected who(m: StockMovement) {
    return m.userEmail?.split('@')[0] ?? 'sistema';
  }
}
