# Contexto del proyecto: Stockly · Control de stock

> Documento de contexto para trabajar con el proyecto: qué hace, cómo está montado y cada
> caso concreto que ya se ha decidido. Última revisión: 2026-10-25.
> Puesta en marcha en `README.md`, APK en `MOVIL.md`, resumen corto en `CLAUDE.md`.

## Qué es

App interna de **control de stock del restaurante**. La usa el personal desde el móvil (APK) o
el navegador. Permite:

- Llevar el **stock** de cada producto, con las entradas y salidas del día a día.
- Gestionar los **proveedores**, que **suben** el stock (pedidos).
- Gestionar los **eventos**, que **bajan** el stock (consumo).
- Revisar en **Control** el historial de cada movimiento: quién lo hizo, cuándo, cuánto y por qué.

Sentido del stock:

```
Proveedor ──(pedido recibido)──▶  STOCK  ──(evento descontado)──▶ consumo
                       ▲  ajustes a mano (−/+, entradas/salidas)  ▼
```

## Stack

| Capa | Tecnología |
|---|---|
| Front | Angular 22 (standalone, signals, control flow `@if/@for`), sin librería de componentes: CSS propio (`styles.scss` + estilos por componente). Locale `es`. |
| Datos | **Sin backend propio.** `supabase-js` habla directamente con Supabase (PostgREST + Auth). Seguridad = login + RLS. |
| BBDD | PostgreSQL de Supabase, esquema propio **`aletes`** (ver abajo). Todo en `supabase/schema.sql` (idempotente). |
| Móvil | APK con Capacitor 8 (app «Stockly», id `com.aletes.stock`), `cd frontend && npm run apk` → `Stockly.apk`. |

## Supabase

- Todo vive en su propio esquema **`aletes`** (ninguna tabla ni función en `public`), así el
  proyecto de Supabase se puede compartir con otras apps sin que se toquen. Útil porque el plan
  gratis solo permite 2 proyectos.
- El esquema tiene que estar en *Settings > Data API > Exposed schemas* (junto a los que ya haya,
  como `public` y `graphql_public`). El front lo elige con
  `createClient(..., { db: { schema: environment.supabaseSchema } })`.
- **Quién entra**: el usuario tiene que existir en *Authentication > Users* (creado por el
  administrador, con *Auto Confirm User*) **y** su email tiene que estar en la tabla
  `aletes.staff`:

  ```sql
  insert into aletes.staff (email) values ('persona@empresa.com');
  ```

  `es_personal()` (security definer) consulta esa tabla y lo usan todas las políticas RLS. La
  app no puede leer ni cambiar `staff`: los emails no están en el código ni en el repo.
- Si el proyecto tiene *Allow new users to sign up* activo, cualquiera puede registrarse, pero
  sin estar en `staff` no ve nada. Aun así se recomienda desactivarlo.
- **Ejecutar el esquema**: en el SQL Editor, o con `pg` y un fichero `.env` con las credenciales
  de Postgres (fuera del repo).
- **Configuración del front**: los valores reales (URL y clave *publishable*) van en
  `frontend/src/environments/environment.local.ts`, ignorado por git. `environment.ts` es solo la
  plantilla; las configuraciones de Angular sustituyen uno por otro al compilar. Nunca la
  contraseña de la BBDD ni la `service_role`.

## Modelo de datos (`aletes.*`)

| Tabla | Para qué | Notas |
|---|---|---|
| `categories` | Agrupación de productos (Bebidas, Carnes…) | `name` único. No se puede borrar si tiene productos (`on delete restrict`). |
| `suppliers` | Proveedores | `name` único, `phone` y `notes` opcionales. |
| `products` | Producto con su stock | `unit` ∈ UNIT/KG/G/L/ML/BOX/PACK/BOTTLE. `quantity ≥ 0` (CHECK). `min_stock`. `category_id` obligatorio. Único `(category_id, name)`. Sus proveedores van en `product_suppliers`. |
| `product_suppliers` | Qué proveedores traen cada producto (**varios por producto**) | PK `(product_id, supplier_id)`; al borrar el producto o el proveedor se borra solo el vínculo. Sustituye a la antigua columna `products.supplier_id` (migrada y eliminada por el propio `schema.sql`). |
| `favorite_orders` + `favorite_order_items` | **Pedidos favoritos**: lo que se suele pedir a un proveedor, con la cantidad habitual de cada producto | Al borrar el proveedor se borran (cascade). Único `(supplier_id, name)`. |
| `events` + `event_items` | **Eventos**: lo que consume un evento | `event_date`, `guests` (comensales, opcional), `notes`, `applied_at`/`applied_by` (cuándo y quién lo descontó). |
| `stock_movements` | **Historial** de cada cambio de stock | Lo escribe solo el trigger. Ver «Historial». |
| `companies` | **Empresa**: nombre, razón social, CIF/NIF, contacto, dirección, web y **logo** | Hoy se usa una sola fila (la de id más bajo). Desde la app solo se lee y se edita; las altas y bajas son cosa del administrador. Ver «Empresa». |

`updated_at` se actualiza solo (trigger `set_updated_at`).

### Funciones (RPC), todas atómicas

| Función | Qué hace |
|---|---|
| `adjust_stock(id, delta)` | Suma o resta en un único `UPDATE`, así dos personas a la vez no se pisan. Si quedaría negativo: «El stock no puede quedar en negativo». Marca el movimiento como `manual`. |
| `receive_order(items, note, order_id)` | Recibe un pedido: suma todas las líneas de una vez. Marca `order`, con el nombre y el id del pedido. |
| `set_product_suppliers(product_id, supplier_ids[])` | Deja al producto exactamente con esos proveedores (lo usa el diálogo de producto). |
| `set_supplier_products(supplier_id, product_ids[])` | Deja al proveedor exactamente con esos productos, sin tocar a los demás proveedores («Asignar» en la ficha del proveedor). |
| `save_favorite_order(id, supplier_id, name, items)` | Crea (id null) o reemplaza un pedido favorito con sus líneas. |
| `save_event_items(event_id, items)` | Reemplaza el consumo apuntado de un evento. Falla si ya se descontó. |
| `consume_event(event_id)` | Resta del stock todo el consumo del evento, **una sola vez**. Ver «Eventos». |

Los errores de estas funciones (`raise exception`) llegan con código `P0001` y el mensaje ya en
español; `api.service` los muestra tal cual.

## Casos concretos ya resueltos

### Stock (pantalla principal)
- Lista en tarjetas con botones **−/+** grandes que suman o restan 1 con `adjust_stock`.
- Cada producto lleva un **icono SVG genérico**, **solo en Stock** (`stock/product-icon.ts`; no son
  imágenes reales ni hay subida de fotos). Se elige primero por el nombre y, si no, por la unidad:
  - Por nombre: «barril» → barril; lata, Red Bull, refresco… → lata; vino, ron, whisky, tequila,
    anís… → botella.
  - Por unidad: BOTTLE → botella, L/ML → gota, KG/G → peso, BOX → caja, PACK → paquete,
    UNIT → etiqueta.

  Más adelante se pensó en fotos con la cámara del móvil guardadas en Supabase Storage; de momento
  no está hecho.
- Tocando el producto se abre una hoja con «Cantidad a mover» y los botones **Entrada** /
  **Salida**, para cantidades grandes o con decimales. Desde ahí, «Editar» abre el diálogo del
  producto.
- «Ver por» **Categorías** o **Proveedores**: cambia los chips de filtro. Con proveedores, un
  producto de varios proveedores sale en el chip de cada uno, y también hay «Sin proveedor». La elección se guarda en el `localStorage` de cada dispositivo (clave
  `aletes.stock.agrupar`).
- Botón «Bajo mín.»: muestra los productos con `quantity ≤ min_stock`. **Ojo:** con mínimo 0 y
  stock 0 también cuentan como bajo mínimos. Está pendiente decidir si solo deben contar los que
  tienen mínimo > 0.

### Productos
- Alta, edición y borrado **siempre en el diálogo global de producto**
  (`ProductEditor.create/edit`), que se puede abrir desde cualquier pantalla. Al guardar o borrar
  emite `changed` y las pantallas abiertas recargan.
- Desde la ficha de un proveedor o de una categoría, «+ Nuevo» abre el diálogo con ese proveedor
  o esa categoría ya puestos.
- Cambiar la cantidad en el diálogo de producto queda en el historial como **Corrección**. Dar de
  alta un producto con stock queda como **Alta**.
- Al borrar un producto, su historial se conserva (con el nombre guardado) y se quita de los
  pedidos favoritos y de los consumos de eventos (cascade).

### Categorías
- La lista lleva a la **ficha** de cada categoría, con sus productos. «+ Nueva» abre un diálogo y
  al crearla entra directo en su ficha.
- Ficha: «Editar» abre un diálogo con nombre, descripción y el botón de borrar, que está
  desactivado si la categoría tiene productos.
- «Asignar» **trae productos de otras categorías**: solo se pueden mover, no quitar, porque un
  producto siempre tiene que tener categoría. Usa el selector común con buscador y filtro por
  categoría.

### Proveedores
- **Un producto puede tener varios proveedores**: según el día se pide a uno o a otro, por ejemplo
  el langostino a un mayorista u otro. Lo que importa es el **recuento**, que es uno solo por
  producto: lo sube el pedido de cualquiera de ellos y lo bajan los ajustes y eventos igual.
- En el diálogo de producto, los proveedores son chips que se marcan y desmarcan (varios a la
  vez). Desde la ficha de un proveedor, «+ Nuevo» lo deja ya marcado.
- La lista lleva a la **ficha** de cada proveedor: teléfono para llamar, sus pedidos favoritos y
  sus productos.
- «Asignar» marca y desmarca qué productos trae **este** proveedor. Desmarcar solo quita este
  vínculo; los demás proveedores del producto se mantienen. Usa el selector con buscador y filtro por categoría (pensado para cuando haya cientos
  de productos).
- Borrar un proveedor: sus productos se quedan (con sus otros proveedores, si los tienen) y sus
  pedidos favoritos se borran.
- En el pedido favorito salen los productos de ese proveedor. Con «Mostrar productos de otros
  proveedores» salen todos, y los que no son suyos indican de quién son.

### Pedidos favoritos (suben stock)
- Guardan lo que se suele pedir a un proveedor y en qué cantidad. Se crean y editan en una
  **página fija con forma de diálogo** (`/proveedores/:id/pedidos/...`): cabecera y botones
  siempre visibles, y solo la lista hace scroll.
- Al pulsar un pedido en la ficha del proveedor se abre la lista con la cantidad guardada y el
  stock actual. Las cantidades se pueden cambiar **solo para esa vez**. Botones:
  - **Copiar lista**: texto para mandar al proveedor por WhatsApp.
  - **Recibido: sumar**: `receive_order` suma todo al stock de una vez. Queda en el historial como
    **Pedido · {nombre}**, enlazado con `order_id`.

### Eventos (bajan stock)
- Un evento tiene nombre, fecha, **comensales** (opcional; de momento es solo una referencia para
  comparar eventos parecidos) y notas.
- Flujo en dos pasos, para que nada se descuente sin querer:
  1. **Apuntar consumo** (`/eventos/:id/consumo`, página fija con forma de diálogo): la cantidad
     consumida de cada producto, con buscador, filtro por categoría y «Ver solo lo apuntado». Se
     marca en rojo lo que supera el stock actual. **Esto solo lo apunta; el stock no cambia.**
  2. **Descontar del stock**, en la ficha y tras confirmar: `consume_event`.
- Reglas de `consume_event`:
  - Se descuenta **una sola vez**: queda `applied_at`/`applied_by` y un segundo intento falla.
  - Si algún producto **no tiene stock suficiente**, no se descuenta nada y el mensaje dice
    cuáles y cuánto hay (p. ej. «No hay stock suficiente de: Cervero (hay 0)»). Hay que ajustar el
    stock o el consumo antes.
  - Una vez descontado, **el consumo queda fijo** (`save_event_items` falla). Los errores se
    corrigen con un ajuste en Stock.
  - Cada línea queda en el historial como **Evento · {nombre}**, enlazada con `event_id`.
- La ficha muestra, para cada producto, la **cantidad por comensal** (consumo ÷ comensales), como
  referencia para eventos futuros. Calcular el consumo a partir de los comensales todavía **no**
  está hecho.
- Borrar un evento ya descontado **no devuelve el stock**; sus movimientos se quedan en Control
  con el nombre. Borrar uno pendiente borra solo lo apuntado.

### Empresa y logo
- La cabecera (arriba a la izquierda) muestra el **logo y el nombre** de la empresa, que salen de
  `aletes.companies` (`CompanyService`).
  - En escritorio estrecho (801–1100 px) solo se ve el logo, para que quepa el menú.
  - En móvil, el nombre ocupa el espacio hasta el botón «Salir».
- Se guardan en `localStorage` (`aletes.empresa`) para que salgan al instante al abrir la app, y
  se refrescan de la BBDD al iniciar sesión.
- El logo se guarda **en la propia fila**, como data URL (`data:image/png;base64,…`, menos de
  500 KB por CHECK).
  - Para cambiarlo: desde **Perfil** (ver abajo), o con `update aletes.companies set logo = '…'
    where id = 1`.
- Se eligió data URL y no Supabase Storage porque es una sola imagen pequeña y así no hace falta
  un bucket ni la clave `service_role` para subirla.
- **Página Perfil** (`/perfil`, última opción del menú):
  - Muestra el logo, el nombre, la razón social, CIF/NIF, teléfono (se puede llamar), email,
    dirección en una línea, web y el email de la sesión.
  - «Editar» abre un diálogo con todos los campos y el logo:
    - «Cambiar logo» abre la galería o la cámara. La imagen se reduce en el móvil a un máximo de
      256 px (PNG, o JPEG si pesa más de unos 300 KB) antes de guardarla.
    - «Quitar» deja la empresa sin logo; la cabecera muestra solo el nombre.
  - El CIF se guarda en mayúsculas y los campos vacíos como null.
  - Al guardar se actualizan la cabecera y la caché al momento (`CompanyService.set`).
- **Preparada para varias empresas, pero sin activar**: si algún día la app sirve a más de una,
  cada tabla necesitará su `company_id` y la RLS filtrará por él. Hoy no hace falta.

### Historial y página Control
- Un trigger en `products` (`log_stock_movement`, `security definer`) registra **cada cambio de
  `quantity`**, venga de donde venga. La app **solo puede leer** el historial: no puede escribirlo
  ni modificarlo, ni siquiera llamando a la API a mano.
- Tipos (`kind`) y cómo se ven:

  | kind | Etiqueta | Origen |
  |---|---|---|
  | `manual` | Ajuste | −/+ y Entrada/Salida en Stock (`adjust_stock`) |
  | `order` | Pedido · {nombre} | Pedido favorito recibido (`receive_order`) |
  | `event` | Evento · {nombre} | Consumo de evento descontado (`consume_event`) |
  | `edit` | Corrección | Cambio de cantidad en el diálogo de producto |
  | `create` | Alta | Producto creado con stock |

  El tipo lo marcan las RPC con `set_config('aletes.mov_kind' / 'mov_note' / 'mov_order' /
  'mov_event', …, true)` y lo **resetean al terminar**, para que no se arrastre a otros cambios de
  la misma transacción. Sin marca, el cambio es `edit` o `create`.
- **Agrupación de toques de 1 en 1** (el caso de «no quiero 10 registros de +1»):
  - Si el **último** movimiento del producto es un `manual` de la **misma persona** con actividad
    hace **menos de 2 minutos**, el nuevo toque se suma a ese registro (`delta`, `quantity_after`
    y `updated_at`) en vez de crear otro. Así, 10 toques de + quedan como un «+10».
  - Si el grupo se compensa a 0 (+1 y luego −1 por error), el registro se borra.
  - Basta con 2 minutos sin tocar ese producto para que el siguiente toque abra un registro nuevo.
    Un pedido o evento entre medias también corta el grupo, y cada persona tiene su propio grupo.
  - En Control, un grupo que duró más de un minuto muestra rango de hora: «14:08–14:10».
- Cada registro guarda: producto (id y nombre), unidad, `delta`, stock que queda
  (`quantity_after`), tipo, nota, email de quien lo hizo, `order_id`/`event_id`, `created_at`
  (primer toque) y `updated_at` (último).
- **Control** (`/control`) muestra **todo el historial**, del más reciente al más antiguo, en
  **páginas de 100** (‹ Más recientes · 1–100 de N · Más antiguos ›), con un separador por día.
  - Los filtros se aplican **en la BBDD**, no sobre la página ya cargada, y cualquier cambio vuelve
    a la primera página.
  - El **día es opcional**: si eliges uno, aparecen ‹ › para moverte por los días y «Todas» para
    quitar el filtro.
  - Buscador de producto (espera 300 ms a que dejes de escribir) y chips Todos / Entradas /
    Salidas. Los contadores salen de consultas `count` sin traer filas.
  - Entradas en verde (+10) y salidas en rojo (−2). La etiqueta de evento enlaza a su ficha.
  - Índice `stock_movements_updated_at_idx (updated_at desc, id desc)` para ordenar y paginar.

## Front: estructura y convenciones

```
frontend/src/app/
├── core/
│   ├── supabase.service.ts      # cliente (esquema aletes) + sesión
│   ├── api.service.ts           # TODAS las consultas/RPC + traducción de errores
│   ├── models.ts                # tipos y etiquetas (unidades, tipos de movimiento)
│   ├── dialog.ts                # <app-dialog>: diálogo común
│   ├── confirm.service.ts       # confirmación propia (nunca confirm() nativo)
│   ├── product-editor.service.ts# abre el diálogo de producto global + `changed`
│   ├── toast.service.ts         # avisos breves (nunca alert())
│   ├── drag-scroll.directive.ts # scroll horizontal de chips con ratón/rueda
│   └── auth.guard.ts
└── features/
    ├── login/
    ├── stock/                   # pantalla principal
    ├── products/                # product-dialog (global) + product-picker (Asignar)
    ├── categories/              # lista + ficha
    ├── suppliers/               # lista + ficha + pedido favorito (página-diálogo)
    ├── events/                  # lista + ficha + consumo (página-diálogo)
    ├── control/                 # historial
    └── profile/                 # Perfil: datos de la empresa y logo
```

- **Altas y ediciones siempre en diálogo** (`<app-dialog>`): hoja que sube desde abajo en móvil y
  ventana centrada en escritorio. Se cierra con la ✕, tocando fuera o con Escape (si hay una
  confirmación encima, Escape cierra solo la confirmación). No se ponen formularios fijos en las
  páginas.
- Las pantallas con **listas largas para rellenar** (pedido favorito, consumo de evento) son
  **páginas fijas con forma de diálogo** (`.page-dialog`, a pantalla completa en móvil). Los
  botones al pie de diálogos con listas largas llevan `.sticky-actions`.
- **Nunca `confirm()` ni `alert()` nativos**: el navegador integrado y algunos WebView los cancelan
  solos. Usar `ConfirmService.ask()` y `ToastService`.
- **Mobile-first**, con el corte en **800 px**:
  - Hasta 800 px: barra inferior.
  - Desde 801 px: barra superior.
  - Las dos con el mismo orden: **Stock · Categorías · Proveedores · Eventos · Control · Perfil**.
  - Inputs a 16 px, para que el móvil no haga zoom al tocarlos.
  - Botones y zonas táctiles de al menos 44 px.
  - Márgenes `safe-area-inset` para el notch y la barra de gestos.

  Una tablet en vertical (768–820 px) queda justo en el corte; en horizontal se ve la versión de
  escritorio.
- Fichas con estilos comunes en `styles.scss`: `.page-header.detail`, `.block`, `.block-head`,
  `.list-card`, `.prod`.
- Textos de interfaz y comentarios en **español**.

## Operativa

- Desarrollo: `cd frontend && npm start` (puerto 4200). Hay que entrar con un usuario que
  esté en `aletes.staff`. Requiere `frontend/src/environments/environment.local.ts`. Demo: `ng serve --configuration demo` (puerto 4300, esquema `aletes_demo`).
- Cambio de BBDD: editar `supabase/schema.sql` y volver a ejecutarlo entero. Es idempotente:
  `create if not exists`, `create or replace`, `drop ... if exists`.
- **Si cambia la firma de una RPC**, hay que poner antes `drop function if exists` con la firma
  vieja (ver `receive_order`).
- APK: `cd frontend && npm run apk`. Hay que regenerarlo si cambian la URL o la clave de Supabase,
  o para que el móvil tenga las últimas pantallas.

## Vídeo de presentación y entorno demo

- `video/` graba el vídeo de demostración (algo más de 2 minutos, 1280×720), con una **empresa
  ficticia** («Restaurante La Plaza»). Enseña la app partiendo de cero: alta, primer login,
  perfil, categorías, proveedor y productos, pedido favorito, stock, evento, Control y bajo
  mínimos. Detalle y cómo volver a grabarlo en `video/README.md`.
- La versión publicada (MP4 + póster) y las capturas están en `docs/`, que es la web de **GitHub
  Pages** con la documentación pública.
- Usa un **entorno demo separado**: el esquema `aletes_demo`, que genera desde cero
  `video/crear-demo.mjs` a partir de `schema.sql`, y la configuración Angular `demo` en el puerto
  4300 (`environment.demo.ts`). Los datos reales no se tocan.
- El usuario demo (su email se pasa a `crear-demo.mjs`, que lo mete en `aletes_demo.staff`). Su sesión la guarda una persona con `video/login.mjs`, que
  escribe la contraseña; ningún script la guarda. Las grabaciones cargan la sesión de
  `video/.sesion-demo.json`, ignorado por git.
- Si cambia `schema.sql`, basta con volver a ejecutar `crear-demo.mjs` antes de grabar.

## Pendiente / ideas

- Decidir si «bajo mínimos» debe contar solo los productos con mínimo > 0.
- Calcular el consumo de un evento a partir de los comensales (con eventos pasados parecidos como
  referencia).
- Motivo en las salidas manuales (merma, rotura, consumo propio…).
- Botón atrás de Android con un diálogo abierto: navega en vez de cerrarlo (se arreglaría con
  `@capacitor/app`).
- Roles (encargado / cocina) con una tabla de perfiles y RLS por rol.
