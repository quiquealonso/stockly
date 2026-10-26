export type Unit = 'UNIT' | 'KG' | 'G' | 'L' | 'ML' | 'BOX' | 'PACK' | 'BOTTLE';

export const UNIT_LABELS: Record<Unit, string> = {
  UNIT: 'Unidades',
  KG: 'Kilos',
  G: 'Gramos',
  L: 'Litros',
  ML: 'Mililitros',
  BOX: 'Cajas',
  PACK: 'Paquetes',
  BOTTLE: 'Botellas',
};

export const UNIT_SHORT: Record<Unit, string> = {
  UNIT: 'ud',
  KG: 'kg',
  G: 'g',
  L: 'l',
  ML: 'ml',
  BOX: 'caja',
  PACK: 'paq',
  BOTTLE: 'bot',
};

export interface Category {
  id: number;
  name: string;
  description: string | null;
  productCount?: number;
}

export interface CategoryRequest {
  name: string;
  description?: string | null;
}

export interface Product {
  id: number;
  name: string;
  unit: Unit;
  quantity: number;
  minStock: number;
  active: boolean;
  lowStock: boolean;
  categoryId: number;
  category?: { id: number; name: string };
  /** Proveedores que lo traen (puede haber varios; el stock es uno solo). */
  supplierIds: number[];
  suppliers: { id: number; name: string }[];
}

export interface ProductRequest {
  name: string;
  unit: Unit;
  quantity: number;
  minStock: number;
  active: boolean;
  categoryId: number;
  supplierIds: number[];
}

export interface ProductFilter {
  categoryId?: number | null;
  lowStock?: boolean;
  search?: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  productCount?: number;
  orderCount?: number;
}

export interface SupplierRequest {
  name: string;
  phone?: string | null;
  notes?: string | null;
}

export interface FavoriteOrderItem {
  productId: number;
  quantity: number;
  product?: Product;
}

/** Pedido favorito: lo que se suele pedir a un proveedor, con su cantidad. */
export interface FavoriteOrder {
  id: number;
  supplierId: number;
  name: string;
  items: FavoriteOrderItem[];
}

export interface FavoriteOrderRequest {
  supplierId: number;
  name: string;
  items: { productId: number; quantity: number }[];
}

/** Empresa (hoy una sola: la de la cabecera). `logo` es una data URL. */
export interface Company {
  id: number;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  province: string | null;
  country: string;
  website: string | null;
  logo: string | null;
}

/** Datos editables de la empresa (todo menos el id). */
export type CompanyRequest = Omit<Company, 'id'>;

/** Origen de un movimiento de stock. */
export type MovementKind = 'manual' | 'order' | 'event' | 'edit' | 'create';

export const MOVEMENT_LABELS: Record<MovementKind, string> = {
  manual: 'Ajuste',
  order: 'Pedido',
  event: 'Evento',
  edit: 'Corrección',
  create: 'Alta',
};

/** Un registro del historial (los toques seguidos de −/+ llegan ya agrupados). */
export interface StockMovement {
  id: number;
  productId: number | null;
  productName: string;
  unit: Unit;
  delta: number;
  quantityAfter: number;
  kind: MovementKind;
  note: string | null;
  userEmail: string | null;
  /** Pedido favorito / evento que lo originó (null si se borró o no aplica). */
  orderId: number | null;
  eventId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Filtros del historial (todos opcionales). */
export interface MovementFilter {
  /** Rango [from, to) por última actividad. */
  from?: Date | null;
  to?: Date | null;
  search?: string;
  direction?: 'all' | 'in' | 'out';
}

export interface EventItem {
  productId: number;
  quantity: number;
  product?: Product;
}

/** Evento: consume stock. `appliedAt` = cuándo se descontó (null = pendiente). */
export interface StockEvent {
  id: number;
  name: string;
  /** 'YYYY-MM-DD' */
  eventDate: string;
  guests: number | null;
  notes: string | null;
  appliedAt: Date | null;
  appliedBy: string | null;
  items: EventItem[];
}

export interface StockEventRequest {
  name: string;
  eventDate: string;
  guests: number | null;
  notes?: string | null;
}
