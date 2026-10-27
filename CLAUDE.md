# Stockly · Control de stock

App de control de stock para restaurantes. **Contexto completo y cada caso decidido en
`context.md`** (leerlo antes de cambios grandes); puesta en marcha en `README.md`; APK en `MOVIL.md`.
Datos de la instalación real (cuentas, cliente, usuarios): `CLAUDE.local.md`, que NO se sube.
**Repo público**: nunca meter emails, refs/claves de Supabase ni datos del cliente.

## Arquitectura

- **Sin backend propio.** El front Angular (`frontend/`) habla directamente con Supabase vía
  `supabase-js`.
- Seguridad = login de Supabase + RLS. Solo entran los emails de la tabla `aletes.staff`
  (`es_personal()`, security definer); se gestiona por SQL, nunca desde la app ni en el repo.
- `supabase/schema.sql` es idempotente: cualquier cambio de BBDD se hace ahí y se vuelve a
  ejecutar en el SQL Editor. El ajuste de stock va por la RPC atómica `adjust_stock`.
- Historial (`stock_movements`, página Control): lo escribe SOLO el trigger
  `log_stock_movement` (security definer) en cada cambio de `products.quantity`; la app solo lee.
  Los toques −/+ seguidos de la misma persona se agrupan en un registro (ventana de 2 min de
  inactividad; si suman 0, se borra). El tipo lo marcan las RPC con
  `set_config('aletes.mov_kind', …)` (y lo resetean al acabar): manual (`adjust_stock`), order
  (`receive_order`, + nombre e `order_id`), event (`consume_event`, + nombre e `event_id`); sin
  marca = edit (cambio desde la ficha) o create (alta).
- Empresa: `aletes.companies` (una fila hoy; logo como data URL). La cabecera muestra logo + nombre vía `core/company.service`;
  se editan (con cambio de logo, reducido a 256 px en el móvil) en la página Perfil.
- Eventos (bajan stock, lo contrario de los pedidos): se apunta el consumo (`save_event_items`) y
  luego se descuenta UNA vez (`consume_event`: todo o nada, falla si falta stock; después el
  consumo queda fijo). `guests` (comensales) es solo referencia (ratio por comensal en la ficha).

## Supabase

- Todo vive en el esquema **`aletes`** (puede compartir proyecto con otras apps que usen `public`).
  Tiene que estar en *Settings > Data API > Exposed schemas*. El front lo elige con `db.schema`
  (`environment.supabaseSchema`).
- Configuración real del front en `frontend/src/environments/environment.local.ts` (ignorado por
  git; `environment.ts` es solo la plantilla). Nunca guardar en el repo la contraseña de la BBDD
  ni la `service_role` / secret key.

## Front (Angular 22, standalone, signals)

- `core/`: `supabase.service` (sesión), `api.service` (consultas + traducción de errores),
  `toast.service` (avisos en vez de `alert()`), `drag-scroll.directive` (scroll horizontal con
  ratón/rueda para los chips), guards.
- `core/confirm.service`: diálogo de confirmación propio. No usar `confirm()` nativo (el
  navegador integrado / algunos WebView lo cancelan solos).
- Altas/ediciones siempre en diálogo (`core/dialog.ts`, hoja inferior en móvil), nunca formularios
  fijos en la página. El de producto es global: `core/product-editor.service` lo abre desde
  cualquier pantalla y emite `changed` para recargar. El pedido favorito es una página con forma de
  diálogo a pantalla completa (`.page-dialog`). Botones al pie de listas largas: `.sticky-actions`.
- `features/`: `login`, `stock`, `categories` (lista + ficha con sus productos), `products`
  (diálogo de producto con borrado, `product-picker` = casillas + buscador + filtro por categoría
  para los «Asignar»), `suppliers` (lista, ficha con productos y pedidos favoritos, pedido favorito),
  `events` (lista, ficha con descontar, consumo como página-diálogo), `control` (historial).
- Proveedores: un producto puede tener **varios** (tabla puente `product_suppliers`; se guardan con
  las RPC `set_product_suppliers` / `set_supplier_products`). El stock es uno por producto: lo
  suben los pedidos de cualquiera de sus proveedores. Pedidos favoritos
  (`favorite_orders` + `favorite_order_items`) = cantidad habitual por producto; al abrirlos se
  puede copiar la lista o "Recibido: sumar" (RPC atómica `receive_order`). Se guardan con la RPC
  `save_favorite_order`. El stock se puede ver por categorías o por proveedores (se recuerda en
  `localStorage` del dispositivo).
- **Mobile-first** (breakpoint 800 px): menú (barra superior en escritorio, inferior en móvil) en el
  orden Stock · Categorías · Proveedores · Eventos · Control · Perfil (el alta de producto está en el
  «+ Nuevo» de Stock y de las fichas). Iconos SVG genéricos de producto solo en Stock. Control:
  todo el historial paginado de 100 en 100, filtros (día opcional, producto, dirección) en la BBDD.
  Lista de stock en tarjetas con −/+ grandes, hoja inferior para entradas/salidas, chips de
  categoría con scroll horizontal y botón "Bajo mín." junto al buscador. Inputs a 16 px,
  objetivos táctiles ≥ 44 px, `safe-area-inset` para notch/barra de gestos. Locale `es`.
- Textos de UI y comentarios en español.

## Vídeo / demo

- `video/`: vídeo promocional grabado con Playwright sobre un entorno demo aparte (esquema
  `aletes_demo` regenerable con `video/crear-demo.mjs`, `ng serve --configuration demo` en :4300),
  con una empresa ficticia. Ver `video/README.md`. Nunca grabar sobre el esquema real `aletes`.
- Demo web (`npm run demo` :4500 / `npm run build:demo` → `docs/demo/`): configuración
  `web-demo` (`environment.web-demo.ts`, sin claves, `demo: true`). `app.config.ts` cambia
  `ApiService`/`SupabaseService` por `core/demo/demo.services.ts` (datos en memoria de
  `demo-data.ts`, login con cualquier email) y usa rutas con `#`. Si cambia la API o la UI,
  actualizar `DemoApiService` (implementa la interfaz pública de `ApiService`) y regenerar.
- `docs/`: GitHub Pages (web morada, claro por defecto, con la demo en vivo en el móvil del hero + vídeo). Logo: `docs/assets/stockly-logo.svg` (copia en `frontend/public/favicon.svg`; iconos de Android generados desde él).

## APK (Capacitor 8)

- `frontend/capacitor.config.json` (appId `com.aletes.stock`, nombre «Stockly»), proyecto en
  `frontend/android/`.
- `cd frontend && npm run apk` → compila, `cap sync`, `gradlew assembleDebug` y copia a
  `Stockly.apk` en la raíz (ignorado por git). Script: `frontend/scripts/build-apk.mjs`
  (crea `android/local.properties` con la ruta por defecto del SDK si falta).
- Las claves de Supabase van dentro del APK: si cambian, regenerar.

## Pendiente / ideas

- Botón atrás de Android con la hoja de ajuste abierta: navega en vez de cerrarla
  (se arreglaría con `@capacitor/app`).
- Ver "Próximos pasos posibles" en `README.md` (roles).
