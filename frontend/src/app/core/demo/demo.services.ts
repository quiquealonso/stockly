import { Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { defer, delay, Observable, of, throwError } from 'rxjs';
import { ApiService } from '../api.service';
import {
  Category,
  CategoryRequest,
  Company,
  CompanyRequest,
  FavoriteOrder,
  FavoriteOrderRequest,
  MovementFilter,
  MovementKind,
  Product,
  ProductFilter,
  ProductRequest,
  StockEvent,
  StockEventRequest,
  StockMovement,
  Supplier,
  SupplierRequest,
} from '../models';
import { SupabaseService } from '../supabase.service';
import { createDemoData, DEMO_EMAIL, DemoProduct } from './demo-data';

/**
 * Modo demo web (`environment.demo`): sustituyen a SupabaseService y ApiService en app.config.ts.
 * Todo vive en memoria con datos ficticios; al recargar la página vuelve a los datos iniciales.
 * Imitan las reglas de la BBDD (RPC atómicas, historial agrupado, eventos de una sola vez).
 */

/** Interfaz pública de un servicio (sin sus miembros privados), para implementarla aquí. */
type Public<T> = { [K in keyof T]: T[K] };

const LATENCY = 120;
/** Ventana en la que los toques −/+ seguidos se agrupan en un registro (como el trigger). */
const GROUP_WINDOW_MS = 2 * 60 * 1000;

/** Responde con una copia (como si viniera de la red) y un pequeño retraso. */
function reply<T>(fn: () => T): Observable<T> {
  return defer(() => {
    try {
      return of(structuredClone(fn())).pipe(delay(LATENCY));
    } catch (e) {
      return throwError(() => e);
    }
  });
}

const fail = (message: string): never => {
  throw new Error(message);
};

const round = (n: number) => Math.round(n * 1000) / 1000;
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

@Injectable()
export class DemoSupabaseService implements Omit<Public<SupabaseService>, 'client'> {
  readonly session = signal<Session | null>(null);
  readonly ready = Promise.resolve();

  get email(): string {
    return this.session()?.user?.email ?? '';
  }

  /** En la demo vale cualquier email y contraseña: no se envían a ningún sitio. */
  async login(email: string, _password: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 300));
    this.session.set({ user: { email: email.trim() || DEMO_EMAIL } } as Session);
  }

  async logout(): Promise<void> {
    this.session.set(null);
  }
}

@Injectable()
export class DemoApiService implements Public<ApiService> {
  private data = createDemoData();
  private nextId = 1000;

  // --- Ayudas ------------------------------------------------------------------

  private toProduct(p: DemoProduct): Product {
    const cat = this.data.categories.find((c) => c.id === p.categoryId);
    const suppliers = this.data.productSuppliers
      .filter((l) => l.productId === p.id)
      .map((l) => this.data.suppliers.find((s) => s.id === l.supplierId)!)
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      ...p,
      lowStock: p.quantity <= p.minStock,
      category: cat ? { id: cat.id, name: cat.name } : undefined,
      supplierIds: suppliers.map((s) => s.id),
      suppliers,
    };
  }

  private product(id: number): DemoProduct {
    return this.data.products.find((p) => p.id === id) ?? fail('Producto no encontrado');
  }

  private withProducts<T extends { productId: number; quantity: number }>(items: T[]) {
    return items
      .map((i) => ({ ...i, product: this.toProduct(this.product(i.productId)) }))
      .sort((a, b) => a.product.name.localeCompare(b.product.name));
  }

  private checkName(list: { id: number; name: string }[], name: string, id: number | null) {
    const n = normalize(name.trim());
    if (list.some((x) => x.id !== id && normalize(x.name) === n)) {
      fail('Ya existe un registro con ese nombre');
    }
  }

  private get user() {
    return DEMO_EMAIL;
  }

  /** Cambia la cantidad y lo apunta en el historial, como el trigger `log_stock_movement`. */
  private setQuantity(
    p: DemoProduct,
    quantity: number,
    kind: MovementKind,
    extra: { note?: string | null; orderId?: number | null; eventId?: number | null } = {},
  ) {
    const delta = round(quantity - p.quantity);
    p.quantity = round(quantity);
    if (delta === 0) return;
    const now = new Date();
    const movements = this.data.movements;
    if (kind === 'manual') {
      const last = movements
        .filter((m) => m.productId === p.id)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
      if (
        last &&
        last.kind === 'manual' &&
        last.userEmail === this.user &&
        now.getTime() - last.updatedAt.getTime() < GROUP_WINDOW_MS
      ) {
        last.delta = round(last.delta + delta);
        last.quantityAfter = p.quantity;
        last.updatedAt = now;
        if (last.delta === 0) this.data.movements = movements.filter((m) => m !== last);
        return;
      }
    }
    movements.push({
      id: this.nextId++,
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      delta,
      quantityAfter: p.quantity,
      kind,
      note: extra.note ?? null,
      userEmail: this.user,
      orderId: extra.orderId ?? null,
      eventId: extra.eventId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  private checkItems(items: { productId: number; quantity: number }[]) {
    if (items.some((i) => !(i.quantity > 0))) fail('Las cantidades deben ser mayores que 0');
    items.forEach((i) => this.product(i.productId));
  }

  // --- Empresa -------------------------------------------------------------------

  getCompany(): Observable<Company | null> {
    return reply(() => this.data.company);
  }

  updateCompany(id: number, body: CompanyRequest): Observable<Company> {
    return reply(() => {
      const text = (v: string | null) => v?.trim() || null;
      this.data.company = {
        id,
        name: body.name.trim(),
        legalName: text(body.legalName),
        taxId: text(body.taxId)?.toUpperCase() ?? null,
        email: text(body.email),
        phone: text(body.phone),
        address: text(body.address),
        postalCode: text(body.postalCode),
        city: text(body.city),
        province: text(body.province),
        country: text(body.country) ?? 'España',
        website: text(body.website),
        logo: body.logo,
      };
      return this.data.company;
    });
  }

  // --- Categorías ----------------------------------------------------------------

  getCategories(): Observable<Category[]> {
    return reply(() =>
      [...this.data.categories]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({
          ...c,
          productCount: this.data.products.filter((p) => p.categoryId === c.id).length,
        })),
    );
  }

  getCategory(id: number): Observable<Category> {
    return reply(
      () => this.data.categories.find((c) => c.id === id) ?? fail('Registro no encontrado'),
    );
  }

  moveProductsToCategory(categoryId: number, productIds: number[]): Observable<null> {
    return reply(() => {
      this.data.products
        .filter((p) => productIds.includes(p.id))
        .forEach((p) => (p.categoryId = categoryId));
      return null;
    });
  }

  createCategory(body: CategoryRequest): Observable<Category> {
    return reply(() => {
      this.checkName(this.data.categories, body.name, null);
      const c = { id: this.nextId++, name: body.name.trim(), description: body.description ?? null };
      this.data.categories.push(c);
      return c;
    });
  }

  updateCategory(id: number, body: CategoryRequest): Observable<Category> {
    return reply(() => {
      this.checkName(this.data.categories, body.name, id);
      const c = this.data.categories.find((x) => x.id === id) ?? fail('Registro no encontrado');
      Object.assign(c, { name: body.name.trim(), description: body.description ?? null });
      return c;
    });
  }

  deleteCategory(id: number): Observable<null> {
    return reply(() => {
      if (this.data.products.some((p) => p.categoryId === id)) {
        fail('No se puede borrar: tiene productos asociados');
      }
      this.data.categories = this.data.categories.filter((c) => c.id !== id);
      return null;
    });
  }

  // --- Productos -----------------------------------------------------------------

  getProducts(filter: ProductFilter = {}): Observable<Product[]> {
    return reply(() => {
      const term = filter.search ? normalize(filter.search) : '';
      return this.data.products
        .filter((p) => !filter.categoryId || p.categoryId === filter.categoryId)
        .filter((p) => !term || normalize(p.name).includes(term))
        .map((p) => this.toProduct(p))
        .filter((p) => !filter.lowStock || p.lowStock)
        .sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  getProduct(id: number): Observable<Product> {
    return reply(() => this.toProduct(this.product(id)));
  }

  createProduct(body: ProductRequest): Observable<number> {
    return reply(() => {
      this.checkName(this.data.products, body.name, null);
      if (body.quantity < 0 || body.minStock < 0) fail('Datos no válidos (revisa nombres y cantidades)');
      const p: DemoProduct = {
        id: this.nextId++,
        name: body.name.trim(),
        unit: body.unit,
        quantity: 0,
        minStock: body.minStock,
        active: body.active,
        categoryId: body.categoryId,
      };
      this.data.products.push(p);
      this.setProductLinks(p.id, body.supplierIds);
      this.setQuantity(p, body.quantity, 'create');
      return p.id;
    });
  }

  updateProduct(id: number, body: ProductRequest): Observable<number> {
    return reply(() => {
      this.checkName(this.data.products, body.name, id);
      if (body.quantity < 0 || body.minStock < 0) fail('Datos no válidos (revisa nombres y cantidades)');
      const p = this.product(id);
      Object.assign(p, {
        name: body.name.trim(),
        unit: body.unit,
        minStock: body.minStock,
        active: body.active,
        categoryId: body.categoryId,
      });
      this.setProductLinks(id, body.supplierIds);
      this.setQuantity(p, body.quantity, 'edit');
      return id;
    });
  }

  adjustStock(id: number, delta: number): Observable<Product> {
    return reply(() => {
      if (delta === 0) fail('El ajuste no puede ser 0');
      const p = this.product(id);
      if (p.quantity + delta < 0) fail('El stock no puede quedar en negativo');
      this.setQuantity(p, p.quantity + delta, 'manual');
      return this.toProduct(p);
    });
  }

  deleteProduct(id: number): Observable<null> {
    return reply(() => {
      this.product(id);
      this.data.products = this.data.products.filter((p) => p.id !== id);
      this.data.productSuppliers = this.data.productSuppliers.filter((l) => l.productId !== id);
      this.data.favoriteOrders.forEach((o) => (o.items = o.items.filter((i) => i.productId !== id)));
      this.data.events.forEach((e) => (e.items = e.items.filter((i) => i.productId !== id)));
      this.data.movements.forEach((m) => m.productId === id && (m.productId = null));
      return null;
    });
  }

  // --- Proveedores ---------------------------------------------------------------

  getSuppliers(): Observable<Supplier[]> {
    return reply(() =>
      [...this.data.suppliers]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({
          ...s,
          productCount: this.data.productSuppliers.filter((l) => l.supplierId === s.id).length,
          orderCount: this.data.favoriteOrders.filter((o) => o.supplierId === s.id).length,
        })),
    );
  }

  getSupplier(id: number): Observable<Supplier> {
    return reply(
      () => this.data.suppliers.find((s) => s.id === id) ?? fail('Registro no encontrado'),
    );
  }

  createSupplier(body: SupplierRequest): Observable<any> {
    return reply(() => {
      this.checkName(this.data.suppliers, body.name, null);
      const s = {
        id: this.nextId++,
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        notes: body.notes?.trim() || null,
      };
      this.data.suppliers.push(s);
      return s;
    });
  }

  updateSupplier(id: number, body: SupplierRequest): Observable<any> {
    return reply(() => {
      this.checkName(this.data.suppliers, body.name, id);
      const s = this.data.suppliers.find((x) => x.id === id) ?? fail('Registro no encontrado');
      Object.assign(s, {
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        notes: body.notes?.trim() || null,
      });
      return s;
    });
  }

  deleteSupplier(id: number): Observable<null> {
    return reply(() => {
      this.data.suppliers = this.data.suppliers.filter((s) => s.id !== id);
      this.data.productSuppliers = this.data.productSuppliers.filter((l) => l.supplierId !== id);
      this.data.favoriteOrders = this.data.favoriteOrders.filter((o) => o.supplierId !== id);
      return null;
    });
  }

  setSupplierProducts(supplierId: number, productIds: number[]): Observable<null> {
    return reply(() => {
      this.data.productSuppliers = [
        ...this.data.productSuppliers.filter((l) => l.supplierId !== supplierId),
        ...productIds.map((productId) => ({ productId, supplierId })),
      ];
      return null;
    });
  }

  private setProductLinks(productId: number, supplierIds: number[]) {
    this.data.productSuppliers = [
      ...this.data.productSuppliers.filter((l) => l.productId !== productId),
      ...supplierIds.map((supplierId) => ({ productId, supplierId })),
    ];
  }

  // --- Pedidos favoritos ---------------------------------------------------------

  private toOrder(o: (typeof this.data.favoriteOrders)[number]): FavoriteOrder {
    return { ...o, items: this.withProducts(o.items) };
  }

  getFavoriteOrders(supplierId: number): Observable<FavoriteOrder[]> {
    return reply(() =>
      this.data.favoriteOrders
        .filter((o) => o.supplierId === supplierId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((o) => this.toOrder(o)),
    );
  }

  getFavoriteOrder(id: number): Observable<FavoriteOrder> {
    return reply(() =>
      this.toOrder(this.data.favoriteOrders.find((o) => o.id === id) ?? fail('Pedido no encontrado')),
    );
  }

  saveFavoriteOrder(id: number | null, body: FavoriteOrderRequest): Observable<number> {
    return reply(() => {
      if (!body.items.length) fail('El pedido debe tener al menos un producto');
      this.checkItems(body.items);
      const items = body.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
      if (id == null) {
        const o = { id: this.nextId++, supplierId: body.supplierId, name: body.name.trim(), items };
        this.data.favoriteOrders.push(o);
        return o.id;
      }
      const o = this.data.favoriteOrders.find((x) => x.id === id) ?? fail('Pedido no encontrado');
      Object.assign(o, { name: body.name.trim(), items });
      return id;
    });
  }

  deleteFavoriteOrder(id: number): Observable<null> {
    return reply(() => {
      this.data.favoriteOrders = this.data.favoriteOrders.filter((o) => o.id !== id);
      this.data.movements.forEach((m) => m.orderId === id && (m.orderId = null));
      return null;
    });
  }

  receiveOrder(
    items: { productId: number; quantity: number }[],
    order: { id: number; name: string } | null = null,
  ): Observable<Product[]> {
    return reply(() => {
      if (!items.length) fail('El pedido debe tener al menos un producto');
      this.checkItems(items);
      return items.map((i) => {
        const p = this.product(i.productId);
        this.setQuantity(p, p.quantity + i.quantity, 'order', {
          note: order?.name ?? null,
          orderId: order?.id ?? null,
        });
        return this.toProduct(p);
      });
    });
  }

  // --- Eventos -------------------------------------------------------------------

  private event(id: number) {
    return this.data.events.find((e) => e.id === id) ?? fail('Evento no encontrado');
  }

  private toEvent(e: (typeof this.data.events)[number]): StockEvent {
    return { ...e, items: this.withProducts(e.items) };
  }

  getEvents(): Observable<(StockEvent & { itemCount: number })[]> {
    return reply(() =>
      [...this.data.events]
        .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.id - a.id)
        .map((e) => ({ ...e, items: [], itemCount: e.items.length })),
    );
  }

  getEvent(id: number): Observable<StockEvent> {
    return reply(() => this.toEvent(this.event(id)));
  }

  createEvent(body: StockEventRequest): Observable<any> {
    return reply(() => {
      const e = {
        id: this.nextId++,
        name: body.name.trim(),
        eventDate: body.eventDate,
        guests: body.guests,
        notes: body.notes?.trim() || null,
        appliedAt: null,
        appliedBy: null,
        items: [],
      };
      this.data.events.push(e);
      return e;
    });
  }

  updateEvent(id: number, body: StockEventRequest): Observable<any> {
    return reply(() => {
      const e = this.event(id);
      Object.assign(e, {
        name: body.name.trim(),
        eventDate: body.eventDate,
        guests: body.guests,
        notes: body.notes?.trim() || null,
      });
      return e;
    });
  }

  deleteEvent(id: number): Observable<null> {
    return reply(() => {
      this.data.events = this.data.events.filter((e) => e.id !== id);
      this.data.movements.forEach((m) => m.eventId === id && (m.eventId = null));
      return null;
    });
  }

  saveEventItems(id: number, items: { productId: number; quantity: number }[]): Observable<null> {
    return reply(() => {
      const e = this.event(id);
      if (e.appliedAt) fail('Este evento ya se descontó del stock: su consumo no se puede cambiar');
      this.checkItems(items);
      e.items = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
      return null;
    });
  }

  consumeEvent(id: number): Observable<Product[]> {
    return reply(() => {
      const e = this.event(id);
      if (e.appliedAt) fail('Este evento ya se descontó del stock');
      if (!e.items.length) fail('El evento no tiene consumo apuntado');
      const short = e.items
        .map((i) => this.product(i.productId))
        .filter((p, k) => p.quantity < e.items[k].quantity)
        .map((p) => p.name);
      if (short.length) {
        fail(`No hay stock suficiente de: ${short.join(', ')}. Ajusta el stock o el consumo.`);
      }
      e.appliedAt = new Date();
      e.appliedBy = this.user;
      return e.items.map((i) => {
        const p = this.product(i.productId);
        this.setQuantity(p, p.quantity - i.quantity, 'event', { note: e.name, eventId: e.id });
        return this.toProduct(p);
      });
    });
  }

  // --- Historial -----------------------------------------------------------------

  private filterMovements(filter: MovementFilter): StockMovement[] {
    const term = filter.search?.trim() ? normalize(filter.search.trim()) : '';
    return this.data.movements.filter(
      (m) =>
        (!filter.from || m.updatedAt >= filter.from) &&
        (!filter.to || m.updatedAt < filter.to) &&
        (!term || normalize(m.productName).includes(term)) &&
        (filter.direction !== 'in' || m.delta > 0) &&
        (filter.direction !== 'out' || m.delta < 0),
    );
  }

  async getMovementsPage(
    filter: MovementFilter,
    page: number,
    pageSize: number,
  ): Promise<{ rows: StockMovement[]; total: number }> {
    await new Promise((r) => setTimeout(r, LATENCY));
    const all = this.filterMovements(filter).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.id - a.id,
    );
    return {
      rows: structuredClone(all.slice(page * pageSize, page * pageSize + pageSize)),
      total: all.length,
    };
  }

  async countMovements(filter: MovementFilter): Promise<{ in: number; out: number }> {
    const all = this.filterMovements({ ...filter, direction: 'all' });
    return { in: all.filter((m) => m.delta > 0).length, out: all.filter((m) => m.delta < 0).length };
  }
}
