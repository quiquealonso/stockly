import { Company, MovementKind, Unit } from '../models';

/**
 * Datos FICTICIOS de la demo web («Restaurante La Plaza»). Siempre los mismos al cargar la
 * página; las fechas se calculan desde hoy para que el historial parezca reciente.
 */

export interface DemoProduct {
  id: number;
  name: string;
  unit: Unit;
  quantity: number;
  minStock: number;
  active: boolean;
  categoryId: number;
}

export interface DemoEvent {
  id: number;
  name: string;
  eventDate: string;
  guests: number | null;
  notes: string | null;
  appliedAt: Date | null;
  appliedBy: string | null;
  items: { productId: number; quantity: number }[];
}

export interface DemoMovement {
  id: number;
  productId: number | null;
  productName: string;
  unit: Unit;
  delta: number;
  quantityAfter: number;
  kind: MovementKind;
  note: string | null;
  userEmail: string | null;
  orderId: number | null;
  eventId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="98" fill="#7c2d12"/><circle cx="100" cy="100" r="86" fill="none" stroke="#fde68a" stroke-width="3"/><g fill="#fde68a"><rect x="70" y="40" width="5" height="34" rx="2"/><rect x="80" y="40" width="5" height="34" rx="2"/><rect x="90" y="40" width="5" height="34" rx="2"/><path d="M68 72h29v6c0 6-5 10-10 11v43a4.5 4.5 0 0 1-9 0V89c-5-1-10-5-10-11z"/><path d="M118 40c11 6 16 20 14 40l-6 2v50a4.5 4.5 0 0 1-9 0z"/></g><text x="100" y="160" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#fde68a" font-weight="700">La Plaza</text></svg>`;

export const DEMO_EMAIL = 'equipo@restaurante-laplaza.es';

/** Fecha de hace `days` días a la hora indicada. */
function ago(days: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  // Hoy, nunca en el futuro: si aún no es esa hora, un rato antes de ahora.
  const now = Date.now();
  if (d.getTime() > now) d.setTime(now - (24 - hour) * 4 * 60 * 1000);
  return d;
}

/** 'YYYY-MM-DD' de dentro de `days` días (negativo = pasado). */
function dateIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function createDemoData() {
  const company: Company = {
    id: 1,
    name: 'Restaurante La Plaza',
    legalName: 'La Plaza Restauración S.L. (ficticia)',
    taxId: 'B00000000',
    email: DEMO_EMAIL,
    phone: '960 000 000',
    address: 'Plaza Mayor, 1',
    postalCode: '46001',
    city: 'Valencia',
    province: 'Valencia',
    country: 'España',
    website: null,
    logo: `data:image/svg+xml;base64,${btoa(LOGO_SVG)}`,
  };

  const categories: { id: number; name: string; description: string | null }[] = [
    { id: 1, name: 'Bebidas', description: 'Refrescos, aguas, cervezas y vinos' },
    { id: 2, name: 'Carnes y pescados', description: null },
    { id: 3, name: 'Frutas y verduras', description: null },
    { id: 4, name: 'Despensa', description: 'Secos, aceites y conservas' },
    { id: 5, name: 'Lácteos y huevos', description: null },
    { id: 6, name: 'Limpieza', description: null },
  ];

  const suppliers: { id: number; name: string; phone: string | null; notes: string | null }[] = [
    { id: 1, name: 'Bebidas del Sur', phone: '600 000 001', notes: 'Reparto martes y viernes' },
    { id: 2, name: 'Frescos del Norte', phone: '600 000 002', notes: 'Pedir antes de las 12:00' },
    { id: 3, name: 'Huerta Valenciana', phone: '600 000 003', notes: null },
    { id: 4, name: 'Distribuciones Levante', phone: '600 000 004', notes: 'Despensa y limpieza' },
  ];

  // [nombre, unidad, cantidad, mínimo, categoría, proveedores]
  const rows: [string, Unit, number, number, number, number[]][] = [
    ['Agua mineral 50cl', 'BOTTLE', 72, 48, 1, [1]],
    ['Cerveza barril 30L', 'UNIT', 2, 3, 1, [1]],
    ['Cerveza botellín 33cl', 'BOX', 9, 4, 1, [1]],
    ['Refresco de cola', 'BOX', 6, 4, 1, [1]],
    ['Refresco de limón', 'BOX', 3, 3, 1, [1]],
    ['Vino tinto crianza', 'BOTTLE', 18, 12, 1, [1]],
    ['Vino blanco verdejo', 'BOTTLE', 7, 12, 1, [1]],
    ['Cava brut', 'BOTTLE', 24, 12, 1, [1]],
    ['Ron añejo', 'BOTTLE', 4, 2, 1, [1]],
    ['Ginebra', 'BOTTLE', 5, 3, 1, [1]],
    ['Café en grano', 'KG', 6, 3, 1, [1, 4]],
    ['Solomillo de ternera', 'KG', 4.5, 3, 2, [2]],
    ['Pechuga de pollo', 'KG', 8, 5, 2, [2]],
    ['Secreto ibérico', 'KG', 3.2, 2, 2, [2]],
    ['Merluza', 'KG', 1.5, 3, 2, [2]],
    ['Gamba roja', 'KG', 2, 1, 2, [2]],
    ['Calamar', 'KG', 3, 2, 2, [2]],
    ['Tomate', 'KG', 12, 6, 3, [3]],
    ['Lechuga', 'UNIT', 14, 10, 3, [3]],
    ['Cebolla', 'KG', 9, 5, 3, [3]],
    ['Patata', 'KG', 25, 15, 3, [3]],
    ['Limón', 'KG', 2, 3, 3, [3]],
    ['Aceite de oliva virgen extra', 'L', 15, 10, 4, [4, 3]],
    ['Arroz bomba', 'KG', 8, 5, 4, [4]],
    ['Harina de trigo', 'KG', 10, 5, 4, [4]],
    ['Sal gruesa', 'KG', 4, 2, 4, [4]],
    ['Tomate triturado', 'UNIT', 18, 12, 4, [4]],
    ['Huevos', 'UNIT', 90, 60, 5, [2]],
    ['Leche entera', 'L', 12, 12, 5, [4]],
    ['Nata para cocinar', 'L', 6, 4, 5, [4]],
    ['Queso manchego', 'KG', 2.5, 1, 5, [2]],
    ['Lavavajillas profesional', 'L', 10, 5, 6, [4]],
    ['Servilletas de papel', 'PACK', 8, 10, 6, [4]],
  ];

  const products: DemoProduct[] = rows.map(([name, unit, quantity, minStock, categoryId], i) => ({
    id: i + 1,
    name,
    unit,
    quantity,
    minStock,
    active: true,
    categoryId,
  }));
  const productSuppliers = rows.flatMap(([, , , , , sups], i) =>
    sups.map((supplierId) => ({ productId: i + 1, supplierId })),
  );
  const byName = (name: string) => products.find((p) => p.name === name)!.id;

  const favoriteOrders = [
    {
      id: 1,
      supplierId: 1,
      name: 'Bebidas semanal',
      items: [
        ['Agua mineral 50cl', 48],
        ['Cerveza barril 30L', 2],
        ['Refresco de cola', 4],
        ['Refresco de limón', 2],
        ['Vino tinto crianza', 12],
      ],
    },
    {
      id: 2,
      supplierId: 1,
      name: 'Barra fin de semana',
      items: [
        ['Cerveza botellín 33cl', 4],
        ['Ron añejo', 2],
        ['Ginebra', 2],
        ['Cava brut', 6],
      ],
    },
    {
      id: 3,
      supplierId: 2,
      name: 'Lunes carne y pescado',
      items: [
        ['Solomillo de ternera', 3],
        ['Pechuga de pollo', 5],
        ['Merluza', 4],
        ['Huevos', 60],
      ],
    },
    {
      id: 4,
      supplierId: 3,
      name: 'Verdura diaria',
      items: [
        ['Tomate', 6],
        ['Lechuga', 10],
        ['Limón', 2],
      ],
    },
  ].map((o) => ({
    ...o,
    items: o.items.map(([name, quantity]) => ({
      productId: byName(name as string),
      quantity: quantity as number,
    })),
  }));

  const events = [
    {
      id: 1,
      name: 'Boda García',
      eventDate: dateIn(5),
      guests: 120,
      notes: 'Menú de 3 platos + barra libre 2 h',
      appliedAt: null as Date | null,
      appliedBy: null as string | null,
      items: [
        ['Cava brut', 24],
        ['Vino tinto crianza', 18],
        ['Agua mineral 50cl', 60],
        ['Solomillo de ternera', 3],
        ['Gamba roja', 1.5],
      ],
    },
    {
      id: 2,
      name: 'Comunión Martínez',
      eventDate: dateIn(-3),
      guests: 45,
      notes: null,
      appliedAt: ago(3, 23, 10),
      appliedBy: DEMO_EMAIL,
      items: [
        ['Refresco de cola', 3],
        ['Agua mineral 50cl', 30],
        ['Pechuga de pollo', 4],
        ['Patata', 8],
      ],
    },
    {
      id: 3,
      name: 'Cena de empresa',
      eventDate: dateIn(-9),
      guests: 30,
      notes: 'Arroces al centro',
      appliedAt: ago(9, 23, 40),
      appliedBy: DEMO_EMAIL,
      items: [
        ['Arroz bomba', 3],
        ['Gamba roja', 1],
        ['Vino blanco verdejo', 10],
        ['Cerveza barril 30L', 1],
      ],
    },
    {
      id: 4,
      name: 'Cumpleaños Laura',
      eventDate: dateIn(12),
      guests: 25,
      notes: null,
      appliedAt: null,
      appliedBy: null,
      items: [] as (string | number)[][],
    },
  ].map((e): DemoEvent => ({
    ...e,
    items: e.items.map(([name, quantity]) => ({
      productId: byName(name as string),
      quantity: quantity as number,
    })),
  }));

  // Historial: [hace días, hora, producto, delta, tipo, nota, pedido, evento], del más antiguo al más reciente.
  type Raw = [number, number, string, number, MovementKind, string | null, number | null, number | null];
  const raw: Raw[] = [
    [13, 9, 'Agua mineral 50cl', 48, 'order', 'Bebidas semanal', 1, null],
    [13, 9, 'Refresco de cola', 4, 'order', 'Bebidas semanal', 1, null],
    [13, 9, 'Vino tinto crianza', 12, 'order', 'Bebidas semanal', 1, null],
    [12, 8, 'Solomillo de ternera', 3, 'order', 'Lunes carne y pescado', 3, null],
    [12, 8, 'Merluza', 4, 'order', 'Lunes carne y pescado', 3, null],
    [12, 8, 'Huevos', 60, 'order', 'Lunes carne y pescado', 3, null],
    [11, 14, 'Cerveza barril 30L', -1, 'manual', null, null, null],
    [10, 13, 'Lechuga', -4, 'manual', null, null, null],
    [9, 23, 'Arroz bomba', -3, 'event', 'Cena de empresa', null, 3],
    [9, 23, 'Gamba roja', -1, 'event', 'Cena de empresa', null, 3],
    [9, 23, 'Vino blanco verdejo', -10, 'event', 'Cena de empresa', null, 3],
    [9, 23, 'Cerveza barril 30L', -1, 'event', 'Cena de empresa', null, 3],
    [8, 10, 'Tomate', 6, 'order', 'Verdura diaria', 4, null],
    [8, 10, 'Lechuga', 10, 'order', 'Verdura diaria', 4, null],
    [7, 12, 'Café en grano', -1, 'manual', null, null, null],
    [6, 9, 'Agua mineral 50cl', 48, 'order', 'Bebidas semanal', 1, null],
    [6, 9, 'Cerveza barril 30L', 2, 'order', 'Bebidas semanal', 1, null],
    [6, 16, 'Servilletas de papel', -2, 'manual', null, null, null],
    [5, 11, 'Leche entera', 2, 'edit', null, null, null],
    [5, 20, 'Ron añejo', -1, 'manual', null, null, null],
    [4, 13, 'Patata', -5, 'manual', null, null, null],
    [3, 23, 'Refresco de cola', -3, 'event', 'Comunión Martínez', null, 2],
    [3, 23, 'Agua mineral 50cl', -30, 'event', 'Comunión Martínez', null, 2],
    [3, 23, 'Pechuga de pollo', -4, 'event', 'Comunión Martínez', null, 2],
    [3, 23, 'Patata', -8, 'event', 'Comunión Martínez', null, 2],
    [2, 9, 'Queso manchego', 2.5, 'create', null, null, null],
    [2, 12, 'Merluza', -2.5, 'manual', null, null, null],
    [1, 10, 'Tomate', 6, 'order', 'Verdura diaria', 4, null],
    [1, 13, 'Limón', -1, 'manual', null, null, null],
    [1, 21, 'Cerveza botellín 33cl', -2, 'manual', null, null, null],
    [0, 9, 'Huevos', -12, 'manual', null, null, null],
    [0, 11, 'Cerveza barril 30L', -1, 'manual', null, null, null],
  ];
  // Las cantidades «después» se calculan hacia atrás desde el stock actual.
  const running = new Map(products.map((p) => [p.id, p.quantity]));
  const movements: DemoMovement[] = [];
  for (let i = raw.length - 1; i >= 0; i--) {
    const [days, hour, name, delta, kind, note, orderId, eventId] = raw[i];
    const product = products.find((p) => p.name === name)!;
    const after = running.get(product.id)!;
    running.set(product.id, Math.round((after - delta) * 1000) / 1000);
    const at = ago(days, hour, (i * 7) % 60);
    movements.push({
      id: i + 1,
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      delta,
      quantityAfter: after,
      kind,
      note,
      userEmail: DEMO_EMAIL,
      orderId,
      eventId,
      createdAt: at,
      updatedAt: at,
    });
  }

  return {
    company,
    categories,
    suppliers,
    products,
    productSuppliers,
    favoriteOrders,
    events,
    movements,
  };
}

export type DemoData = ReturnType<typeof createDemoData>;
