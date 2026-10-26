import { inject, Injectable } from '@angular/core';
import { PostgrestError } from '@supabase/supabase-js';
import { from, Observable } from 'rxjs';
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
  Unit,
} from './models';
import { SupabaseService } from './supabase.service';

/** Fila de `products` tal y como la devuelve Supabase (snake_case, numeric como string o number). */
interface ProductRow {
  id: number;
  name: string;
  unit: Unit;
  quantity: number | string;
  min_stock: number | string;
  active: boolean;
  category_id: number;
  category?: { id: number; name: string } | null;
  /** Vía la tabla puente product_suppliers. */
  suppliers?: { id: number; name: string }[] | null;
}

interface CategoryRow {
  id: number;
  name: string;
  description: string | null;
  products?: { count: number }[];
}

interface SupplierRow {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  product_suppliers?: { count: number }[];
  favorite_orders?: { count: number }[];
}

interface FavoriteOrderRow {
  id: number;
  supplier_id: number;
  name: string;
  favorite_order_items: {
    product_id: number;
    quantity: number | string;
    product: ProductRow | null;
  }[];
}

interface MovementRow {
  id: number;
  product_id: number | null;
  product_name: string;
  unit: Unit;
  delta: number | string;
  quantity_after: number | string;
  kind: MovementKind;
  note: string | null;
  user_email: string | null;
  order_id: number | null;
  event_id: number | null;
  created_at: string;
  updated_at: string;
}

interface CompanyRow {
  id: number;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  country: string;
  website: string | null;
  logo: string | null;
}

interface EventRow {
  id: number;
  name: string;
  event_date: string;
  guests: number | null;
  notes: string | null;
  applied_at: string | null;
  applied_by: string | null;
  event_items?: { product_id: number; quantity: number | string; product: ProductRow | null }[];
}

const PRODUCT_COLUMNS = 'id, name, unit, quantity, min_stock, active, category_id';
/** Producto con su categoría y sus proveedores (muchos a muchos por product_suppliers). */
const PRODUCT_SELECT = `${PRODUCT_COLUMNS}, category:categories(id, name), suppliers(id, name)`;
const SUPPLIER_COLUMNS = 'id, name, phone, notes';
const EVENT_COLUMNS = 'id, name, event_date, guests, notes, applied_at, applied_by';
const EVENT_SELECT = `${EVENT_COLUMNS}, event_items(product_id, quantity, product:products(${PRODUCT_SELECT}))`;
const ORDER_SELECT = `id, supplier_id, name, favorite_order_items(product_id, quantity, product:products(${PRODUCT_SELECT}))`;

function toProduct(r: ProductRow): Product {
  const quantity = Number(r.quantity);
  const minStock = Number(r.min_stock);
  return {
    id: r.id,
    name: r.name,
    unit: r.unit,
    quantity,
    minStock,
    active: r.active,
    lowStock: quantity <= minStock,
    categoryId: r.category_id,
    category: r.category ?? undefined,
    supplierIds: (r.suppliers ?? []).map((s) => s.id),
    suppliers: [...(r.suppliers ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function toCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    productCount: r.products?.[0]?.count ?? 0,
  };
}

function toSupplier(r: SupplierRow): Supplier {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    notes: r.notes,
    productCount: r.product_suppliers?.[0]?.count ?? 0,
    orderCount: r.favorite_orders?.[0]?.count ?? 0,
  };
}

function toFavoriteOrder(r: FavoriteOrderRow): FavoriteOrder {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    name: r.name,
    items: (r.favorite_order_items ?? [])
      .map((i) => ({
        productId: i.product_id,
        quantity: Number(i.quantity),
        product: i.product ? toProduct(i.product) : undefined,
      }))
      .sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? '')),
  };
}

function toMovement(r: MovementRow): StockMovement {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    unit: r.unit,
    delta: Number(r.delta),
    quantityAfter: Number(r.quantity_after),
    kind: r.kind,
    note: r.note,
    userEmail: r.user_email,
    orderId: r.order_id,
    eventId: r.event_id,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

function toEvent(r: EventRow): StockEvent {
  return {
    id: r.id,
    name: r.name,
    eventDate: r.event_date,
    guests: r.guests,
    notes: r.notes,
    appliedAt: r.applied_at ? new Date(r.applied_at) : null,
    appliedBy: r.applied_by,
    items: (r.event_items ?? [])
      .map((i) => ({
        productId: i.product_id,
        quantity: Number(i.quantity),
        product: i.product ? toProduct(i.product) : undefined,
      }))
      .sort((a, b) => (a.product?.name ?? '').localeCompare(b.product?.name ?? '')),
  };
}

function toEventRow(e: StockEventRequest) {
  return {
    name: e.name.trim(),
    event_date: e.eventDate,
    guests: e.guests,
    notes: e.notes?.trim() || null,
  };
}

function toCompany(r: CompanyRow): Company {
  return {
    id: r.id,
    name: r.name,
    legalName: r.legal_name,
    taxId: r.tax_id,
    email: r.email,
    phone: r.phone,
    address: r.address,
    postalCode: r.postal_code,
    city: r.city,
    province: r.province,
    country: r.country,
    website: r.website,
    logo: r.logo,
  };
}

function toCompanyRow(c: CompanyRequest) {
  const text = (v: string | null) => v?.trim() || null;
  return {
    name: c.name.trim(),
    legal_name: text(c.legalName),
    tax_id: text(c.taxId)?.toUpperCase() ?? null,
    email: text(c.email),
    phone: text(c.phone),
    address: text(c.address),
    postal_code: text(c.postalCode),
    city: text(c.city),
    province: text(c.province),
    country: text(c.country) ?? 'España',
    website: text(c.website),
    logo: c.logo,
  };
}

function toProductRow(p: ProductRequest) {
  return {
    name: p.name.trim(),
    unit: p.unit,
    quantity: p.quantity,
    min_stock: p.minStock,
    active: p.active,
    category_id: p.categoryId,
  };
}

function toSupplierRow(s: SupplierRequest) {
  return { name: s.name.trim(), phone: s.phone?.trim() || null, notes: s.notes?.trim() || null };
}

/** Líneas en el formato jsonb que esperan las funciones de la BBDD. */
function toItemsJson(items: { productId: number; quantity: number }[]) {
  return items.map((i) => ({ product_id: i.productId, quantity: i.quantity }));
}

/** Traduce los errores de Postgres/PostgREST a mensajes legibles. */
function toError(e: PostgrestError): Error {
  switch (e.code) {
    case '23505':
      return new Error('Ya existe un registro con ese nombre');
    case '23503':
      return new Error('No se puede borrar: tiene productos asociados');
    case '23514':
      return new Error('Datos no válidos (revisa nombres y cantidades)');
    case '42501':
      return new Error('No tienes permiso para hacer esto');
    case 'PGRST116':
      return new Error('Registro no encontrado');
    case 'P0001':
      // raise exception de nuestras funciones: el mensaje ya viene en español.
      return new Error(e.message);
  }
  if (/failed to fetch|network/i.test(e.message)) {
    return new Error('No se puede conectar con la base de datos');
  }
  return new Error(e.message);
}

/** Cualquier consulta de supabase-js (sin tipos generados, el resultado se castea a T). */
type SupabaseQuery = PromiseLike<{ data: unknown; error: PostgrestError | null }>;

/** Ejecuta una consulta de supabase-js; si falla, lanza un Error legible. */
async function exec<T>(query: SupabaseQuery): Promise<T> {
  const { data, error } = await query;
  if (error) throw toError(error);
  return data as T;
}

/** Igual que exec(), pero como Observable. */
function run<T>(query: SupabaseQuery): Observable<T> {
  return from(exec<T>(query));
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly db = inject(SupabaseService).client;

  /** La empresa (hoy solo hay una; la de id más bajo). null si no hay ninguna. */
  getCompany(): Observable<Company | null> {
    return from(
      exec<CompanyRow[]>(this.db.from('companies').select('*').order('id').limit(1)).then((rows) =>
        rows?.length ? toCompany(rows[0]) : null,
      ),
    );
  }

  updateCompany(id: number, body: CompanyRequest): Observable<Company> {
    return from(
      exec<CompanyRow>(
        this.db.from('companies').update(toCompanyRow(body)).eq('id', id).select('*').single(),
      ).then((r) => toCompany(r!)),
    );
  }

  getCategories(): Observable<Category[]> {
    return from(
      exec<CategoryRow[]>(
        this.db.from('categories').select('id, name, description, products(count)').order('name'),
      ).then((rows) => (rows ?? []).map(toCategory)),
    );
  }

  getCategory(id: number): Observable<Category> {
    return from(
      exec<CategoryRow>(
        this.db.from('categories').select('id, name, description').eq('id', id).single(),
      ).then((r) => toCategory(r!)),
    );
  }

  /** Mueve los productos indicados a la categoría (un producto siempre tiene categoría). */
  moveProductsToCategory(categoryId: number, productIds: number[]) {
    return run<null>(
      this.db.from('products').update({ category_id: categoryId }).in('id', productIds),
    );
  }

  createCategory(body: CategoryRequest) {
    return run<Category>(
      this.db
        .from('categories')
        .insert({ name: body.name.trim(), description: body.description ?? null })
        .select('id, name, description')
        .single(),
    );
  }

  updateCategory(id: number, body: CategoryRequest) {
    return run<Category>(
      this.db
        .from('categories')
        .update({ name: body.name.trim(), description: body.description ?? null })
        .eq('id', id)
        .select('id, name, description')
        .single(),
    );
  }

  deleteCategory(id: number) {
    return run<null>(this.db.from('categories').delete().eq('id', id));
  }

  getProducts(filter: ProductFilter = {}): Observable<Product[]> {
    let query = this.db.from('products').select(PRODUCT_SELECT).order('name');
    if (filter.categoryId) query = query.eq('category_id', filter.categoryId);
    if (filter.search) query = query.ilike('name', `%${filter.search}%`);
    return from(
      exec<ProductRow[]>(query).then((rows) => {
        const products = (rows ?? []).map(toProduct);
        return filter.lowStock ? products.filter((p) => p.lowStock) : products;
      }),
    );
  }

  getProduct(id: number): Observable<Product> {
    return from(
      exec<ProductRow>(this.db.from('products').select(PRODUCT_SELECT).eq('id', id).single()).then(
        (r) => toProduct(r!),
      ),
    );
  }

  /** Crea el producto y le pone sus proveedores. */
  createProduct(body: ProductRequest): Observable<number> {
    return from(
      (async () => {
        const row = await exec<ProductRow>(
          this.db.from('products').insert(toProductRow(body)).select(PRODUCT_COLUMNS).single(),
        );
        await this.setProductSuppliers(row.id, body.supplierIds);
        return row.id;
      })(),
    );
  }

  /** Guarda el producto y deja exactamente esos proveedores. */
  updateProduct(id: number, body: ProductRequest): Observable<number> {
    return from(
      (async () => {
        await exec(this.db.from('products').update(toProductRow(body)).eq('id', id));
        await this.setProductSuppliers(id, body.supplierIds);
        return id;
      })(),
    );
  }

  /** Suma/resta `delta` en la BBDD de forma atómica (función `adjust_stock`). */
  adjustStock(id: number, delta: number): Observable<Product> {
    return from(
      exec<ProductRow>(this.db.rpc('adjust_stock', { p_id: id, p_delta: delta }).single()).then(
        (r) => toProduct(r!),
      ),
    );
  }

  deleteProduct(id: number) {
    return run<null>(this.db.from('products').delete().eq('id', id));
  }

  // --- Proveedores -------------------------------------------------------------

  getSuppliers(): Observable<Supplier[]> {
    return from(
      exec<SupplierRow[]>(
        this.db
          .from('suppliers')
          .select(`${SUPPLIER_COLUMNS}, product_suppliers(count), favorite_orders(count)`)
          .order('name'),
      ).then((rows) => (rows ?? []).map(toSupplier)),
    );
  }

  getSupplier(id: number): Observable<Supplier> {
    return from(
      exec<SupplierRow>(this.db.from('suppliers').select(SUPPLIER_COLUMNS).eq('id', id).single()).then(
        (r) => toSupplier(r!),
      ),
    );
  }

  createSupplier(body: SupplierRequest) {
    return run<SupplierRow>(
      this.db.from('suppliers').insert(toSupplierRow(body)).select(SUPPLIER_COLUMNS).single(),
    );
  }

  updateSupplier(id: number, body: SupplierRequest) {
    return run<SupplierRow>(
      this.db
        .from('suppliers')
        .update(toSupplierRow(body))
        .eq('id', id)
        .select(SUPPLIER_COLUMNS)
        .single(),
    );
  }

  /** Borra el proveedor: sus productos se quedan (sin ese proveedor) y sus pedidos favoritos se borran. */
  deleteSupplier(id: number) {
    return run<null>(this.db.from('suppliers').delete().eq('id', id));
  }

  /**
   * Deja al proveedor exactamente con `productIds` (función `set_supplier_products`).
   * Los demás proveedores de esos productos no se tocan.
   */
  setSupplierProducts(supplierId: number, productIds: number[]): Observable<null> {
    return run<null>(
      this.db.rpc('set_supplier_products', { p_supplier_id: supplierId, p_product_ids: productIds }),
    );
  }

  /** Deja al producto exactamente con esos proveedores (función `set_product_suppliers`). */
  private setProductSuppliers(productId: number, supplierIds: number[]) {
    return exec<null>(
      this.db.rpc('set_product_suppliers', { p_product_id: productId, p_supplier_ids: supplierIds }),
    );
  }

  // --- Pedidos favoritos -------------------------------------------------------

  getFavoriteOrders(supplierId: number): Observable<FavoriteOrder[]> {
    return from(
      exec<FavoriteOrderRow[]>(
        this.db
          .from('favorite_orders')
          .select(ORDER_SELECT)
          .eq('supplier_id', supplierId)
          .order('name'),
      ).then((rows) => (rows ?? []).map(toFavoriteOrder)),
    );
  }

  getFavoriteOrder(id: number): Observable<FavoriteOrder> {
    return from(
      exec<FavoriteOrderRow>(
        this.db.from('favorite_orders').select(ORDER_SELECT).eq('id', id).single(),
      ).then((r) => toFavoriteOrder(r!)),
    );
  }

  /** Crea (id null) o reemplaza un pedido favorito con sus líneas (función `save_favorite_order`). */
  saveFavoriteOrder(id: number | null, body: FavoriteOrderRequest): Observable<number> {
    return run<number>(
      this.db.rpc('save_favorite_order', {
        p_id: id,
        p_supplier_id: body.supplierId,
        p_name: body.name.trim(),
        p_items: toItemsJson(body.items),
      }),
    );
  }

  deleteFavoriteOrder(id: number) {
    return run<null>(this.db.from('favorite_orders').delete().eq('id', id));
  }

  /**
   * Suma al stock todas las líneas de un pedido recibido, de una vez (función `receive_order`).
   * `note` (nombre del pedido) queda en el historial.
   */
  receiveOrder(
    items: { productId: number; quantity: number }[],
    order: { id: number; name: string } | null = null,
  ): Observable<Product[]> {
    return from(
      exec<ProductRow[]>(
        this.db.rpc('receive_order', {
          p_items: toItemsJson(items),
          p_note: order?.name ?? null,
          p_order_id: order?.id ?? null,
        }),
      ).then((rows) => (rows ?? []).map(toProduct)),
    );
  }

  // --- Eventos -----------------------------------------------------------------

  /** Eventos sin líneas (para la lista), con el nº de productos consumidos. */
  getEvents(): Observable<(StockEvent & { itemCount: number })[]> {
    return from(
      exec<(EventRow & { event_items: { count: number }[] })[]>(
        this.db
          .from('events')
          .select(`${EVENT_COLUMNS}, event_items(count)`)
          .order('event_date', { ascending: false })
          .order('id', { ascending: false }),
      ).then((rows) =>
        (rows ?? []).map((r) => ({
          ...toEvent({ ...r, event_items: [] }),
          itemCount: r.event_items?.[0]?.count ?? 0,
        })),
      ),
    );
  }

  getEvent(id: number): Observable<StockEvent> {
    return from(
      exec<EventRow>(this.db.from('events').select(EVENT_SELECT).eq('id', id).single()).then((r) =>
        toEvent(r!),
      ),
    );
  }

  createEvent(body: StockEventRequest) {
    return run<EventRow>(
      this.db.from('events').insert(toEventRow(body)).select(EVENT_COLUMNS).single(),
    );
  }

  updateEvent(id: number, body: StockEventRequest) {
    return run<EventRow>(
      this.db.from('events').update(toEventRow(body)).eq('id', id).select(EVENT_COLUMNS).single(),
    );
  }

  /** Borra el evento y su consumo apuntado. Si ya se descontó, el historial se conserva. */
  deleteEvent(id: number) {
    return run<null>(this.db.from('events').delete().eq('id', id));
  }

  /** Reemplaza el consumo apuntado (función `save_event_items`; falla si ya se descontó). */
  saveEventItems(id: number, items: { productId: number; quantity: number }[]) {
    return run<null>(
      this.db.rpc('save_event_items', { p_event_id: id, p_items: toItemsJson(items) }),
    );
  }

  /** Resta del stock todo el consumo del evento, una sola vez (función `consume_event`). */
  consumeEvent(id: number): Observable<Product[]> {
    return from(
      exec<ProductRow[]>(this.db.rpc('consume_event', { p_event_id: id })).then((rows) =>
        (rows ?? []).map(toProduct),
      ),
    );
  }

  // --- Historial de movimientos ------------------------------------------------

  /** Consulta del historial con los filtros aplicados en la BBDD. */
  private movementsQuery(filter: MovementFilter, head = false) {
    let q = this.db
      .from('stock_movements')
      .select('*', head ? { count: 'exact', head: true } : { count: 'exact' });
    if (filter.from) q = q.gte('updated_at', filter.from.toISOString());
    if (filter.to) q = q.lt('updated_at', filter.to.toISOString());
    const term = filter.search?.trim();
    if (term) q = q.ilike('product_name', `%${term}%`);
    if (filter.direction === 'in') q = q.gt('delta', 0);
    if (filter.direction === 'out') q = q.lt('delta', 0);
    return q;
  }

  /**
   * Una página del historial, del más reciente al más antiguo, y el total con esos filtros.
   * `page` empieza en 0.
   */
  async getMovementsPage(
    filter: MovementFilter,
    page: number,
    pageSize: number,
  ): Promise<{ rows: StockMovement[]; total: number }> {
    const { data, count, error } = await this.movementsQuery(filter)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw toError(error);
    return { rows: ((data ?? []) as MovementRow[]).map(toMovement), total: count ?? 0 };
  }

  /** Nº de entradas y de salidas con los filtros (sin dirección), sin traer las filas. */
  async countMovements(filter: MovementFilter): Promise<{ in: number; out: number }> {
    const [ins, outs] = await Promise.all([
      this.movementsQuery({ ...filter, direction: 'in' }, true),
      this.movementsQuery({ ...filter, direction: 'out' }, true),
    ]);
    if (ins.error) throw toError(ins.error);
    if (outs.error) throw toError(outs.error);
    return { in: ins.count ?? 0, out: outs.count ?? 0 };
  }
}

/** Mensaje legible de un error (los del servicio ya llegan como `Error`). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ha ocurrido un error inesperado';
}
