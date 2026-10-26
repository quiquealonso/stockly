-- =====================================================================
--  Stockly · control de stock · esquema, seguridad y funciones (Supabase)
--  Ejecutar en Supabase > SQL Editor. Es idempotente: se puede repetir.
--
--  Todo vive en su propio esquema `aletes`, así puede compartir proyecto de Supabase con
--  otras apps (que usen `public`) sin tocarse. El esquema debe estar en
--  Settings > Data API > Exposed schemas.
--
--  DESPUÉS: da acceso al personal (ver sección 0):
--    insert into aletes.staff (email) values ('persona@empresa.com');
-- =====================================================================

create schema if not exists aletes;
grant usage on schema aletes to authenticated, service_role;
revoke all on schema aletes from anon, public;

-- 0. ¿Quién puede usar la app? Los emails de la tabla staff (se gestiona desde el SQL
--    Editor; la app no puede leerla ni cambiarla). Además, el usuario tiene que existir en
--    Supabase Auth.
create table if not exists aletes.staff (
  email      varchar(255) primary key check (email = lower(trim(email))),
  created_at timestamptz  not null default now()
);
alter table aletes.staff enable row level security;
revoke all on aletes.staff from anon, authenticated;

-- security definer: lee staff aunque la app no tenga permiso sobre la tabla.
create or replace function aletes.es_personal() returns boolean
language sql stable security definer set search_path = aletes, pg_temp as $$
  select exists (
    select 1 from aletes.staff
     where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;
revoke execute on function aletes.es_personal() from public, anon;
grant execute on function aletes.es_personal() to authenticated;

-- 1. Tablas -------------------------------------------------------------------
create table if not exists aletes.categories (
  id          serial primary key,
  name        varchar(80)  not null unique check (length(trim(name)) > 0),
  description varchar(255),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create table if not exists aletes.suppliers (
  id          serial primary key,
  name        varchar(120) not null unique check (length(trim(name)) > 0),
  phone       varchar(40),
  notes       varchar(500),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create table if not exists aletes.products (
  id          serial primary key,
  name        varchar(120)  not null check (length(trim(name)) > 0),
  -- Unidad en la que se cuenta el stock
  unit        varchar(10)   not null default 'UNIT'
              check (unit in ('UNIT','KG','G','L','ML','BOX','PACK','BOTTLE')),
  quantity    numeric(10,3) not null default 0 check (quantity >= 0),
  min_stock   numeric(10,3) not null default 0 check (min_stock >= 0),
  active      boolean       not null default true,
  -- restrict: no se puede borrar una categoría que tenga productos
  category_id int           not null references aletes.categories(id) on delete restrict,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now(),
  unique (category_id, name)
);

create index if not exists products_category_id_idx on aletes.products(category_id);

-- Proveedores de cada producto: VARIOS por producto (según el día se pide a uno u otro).
-- El stock es del producto, único: lo suben los pedidos de cualquiera de sus proveedores.
-- Al borrar el producto o el proveedor, se borra solo el vínculo.
create table if not exists aletes.product_suppliers (
  product_id  int         not null references aletes.products(id) on delete cascade,
  supplier_id int         not null references aletes.suppliers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (product_id, supplier_id)
);
create index if not exists product_suppliers_supplier_id_idx
  on aletes.product_suppliers(supplier_id);

-- Migración (una sola vez): antes cada producto tenía como mucho un proveedor en
-- products.supplier_id. Se pasa a product_suppliers y se quita la columna.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'aletes' and table_name = 'products'
                and column_name = 'supplier_id') then
    insert into aletes.product_suppliers (product_id, supplier_id)
    select id, supplier_id from aletes.products where supplier_id is not null
    on conflict do nothing;
    alter table aletes.products drop column supplier_id;
  end if;
end $$;

-- Pedidos favoritos: lo que se suele pedir a un proveedor, con su cantidad.
create table if not exists aletes.favorite_orders (
  id          serial primary key,
  supplier_id int          not null references aletes.suppliers(id) on delete cascade,
  name        varchar(80)  not null check (length(trim(name)) > 0),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  unique (supplier_id, name)
);

create table if not exists aletes.favorite_order_items (
  order_id    int           not null references aletes.favorite_orders(id) on delete cascade,
  product_id  int           not null references aletes.products(id) on delete cascade,
  quantity    numeric(10,3) not null check (quantity > 0),
  primary key (order_id, product_id)
);

create index if not exists favorite_order_items_product_id_idx
  on aletes.favorite_order_items(product_id);

-- updated_at automático
create or replace function aletes.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists categories_updated_at on aletes.categories;
create trigger categories_updated_at before update on aletes.categories
  for each row execute function aletes.set_updated_at();

drop trigger if exists products_updated_at on aletes.products;
create trigger products_updated_at before update on aletes.products
  for each row execute function aletes.set_updated_at();

drop trigger if exists suppliers_updated_at on aletes.suppliers;
create trigger suppliers_updated_at before update on aletes.suppliers
  for each row execute function aletes.set_updated_at();

drop trigger if exists favorite_orders_updated_at on aletes.favorite_orders;
create trigger favorite_orders_updated_at before update on aletes.favorite_orders
  for each row execute function aletes.set_updated_at();

-- 2. Seguridad: solo usuarios autenticados Y de la lista de es_personal() ------
alter table aletes.categories enable row level security;
alter table aletes.products   enable row level security;
alter table aletes.suppliers  enable row level security;
alter table aletes.favorite_orders      enable row level security;
alter table aletes.favorite_order_items enable row level security;
alter table aletes.product_suppliers    enable row level security;

drop policy if exists personal on aletes.product_suppliers;
create policy personal on aletes.product_suppliers for all to authenticated
  using (aletes.es_personal()) with check (aletes.es_personal());
revoke all on aletes.product_suppliers from anon;
grant select, insert, delete on aletes.product_suppliers to authenticated;

drop policy if exists personal on aletes.categories;
drop policy if exists personal on aletes.products;
drop policy if exists personal on aletes.suppliers;
drop policy if exists personal on aletes.favorite_orders;
drop policy if exists personal on aletes.favorite_order_items;
create policy personal on aletes.categories for all to authenticated
  using (aletes.es_personal()) with check (aletes.es_personal());
create policy personal on aletes.products for all to authenticated
  using (aletes.es_personal()) with check (aletes.es_personal());
create policy personal on aletes.suppliers for all to authenticated
  using (aletes.es_personal()) with check (aletes.es_personal());
create policy personal on aletes.favorite_orders for all to authenticated
  using (aletes.es_personal()) with check (aletes.es_personal());
create policy personal on aletes.favorite_order_items for all to authenticated
  using (aletes.es_personal()) with check (aletes.es_personal());

revoke all on aletes.categories, aletes.products, aletes.suppliers,
  aletes.favorite_orders, aletes.favorite_order_items from anon;
grant select, insert, update, delete on aletes.categories, aletes.products, aletes.suppliers,
  aletes.favorite_orders, aletes.favorite_order_items to authenticated;
grant usage, select on all sequences in schema aletes to authenticated;

-- Vínculos producto ↔ proveedor, de una vez (sin estados a medias).
-- Deja al producto exactamente con esos proveedores.
create or replace function aletes.set_product_suppliers(p_product_id int, p_supplier_ids int[])
returns void
language plpgsql security invoker as $$
begin
  delete from aletes.product_suppliers
   where product_id = p_product_id
     and supplier_id <> all (coalesce(p_supplier_ids, '{}'));
  insert into aletes.product_suppliers (product_id, supplier_id)
  select p_product_id, unnest(coalesce(p_supplier_ids, '{}'))
  on conflict do nothing;
end $$;

-- Deja al proveedor exactamente con esos productos (los demás proveedores no se tocan).
create or replace function aletes.set_supplier_products(p_supplier_id int, p_product_ids int[])
returns void
language plpgsql security invoker as $$
begin
  delete from aletes.product_suppliers
   where supplier_id = p_supplier_id
     and product_id <> all (coalesce(p_product_ids, '{}'));
  insert into aletes.product_suppliers (product_id, supplier_id)
  select unnest(coalesce(p_product_ids, '{}')), p_supplier_id
  on conflict do nothing;
end $$;

revoke execute on function aletes.set_product_suppliers(int, int[]) from public, anon;
grant execute on function aletes.set_product_suppliers(int, int[]) to authenticated;
revoke execute on function aletes.set_supplier_products(int, int[]) from public, anon;
grant execute on function aletes.set_supplier_products(int, int[]) to authenticated;

-- 3. Ajuste de stock atómico ----------------------------------------------------
-- Suma/resta en una sola sentencia UPDATE: dos personas ajustando a la vez no
-- se pisan (si el cliente leyera y escribiera la cantidad, se perdería un ajuste).
create or replace function aletes.adjust_stock(p_id int, p_delta numeric)
returns aletes.products
language plpgsql security invoker as $$
declare r aletes.products;
begin
  if p_delta = 0 then
    raise exception 'El ajuste no puede ser 0';
  end if;
  -- Para el historial: ajuste a mano (se agrupa, ver log_stock_movement).
  perform set_config('aletes.mov_kind', 'manual', true);
  update aletes.products
     set quantity = quantity + p_delta
   where id = p_id
  returning * into r;
  perform set_config('aletes.mov_kind', '', true);
  if not found then
    raise exception 'Producto no encontrado';
  end if;
  return r;
exception
  when check_violation then
    raise exception 'El stock no puede quedar en negativo';
end $$;

revoke execute on function aletes.adjust_stock(int, numeric) from public, anon;
grant execute on function aletes.adjust_stock(int, numeric) to authenticated;

-- 4. Pedidos favoritos ----------------------------------------------------------
-- Guarda cabecera + líneas de una vez (si falla algo, no queda a medias).
-- p_items: [{"product_id": 1, "quantity": 6}, ...]. p_id null = crear.
create or replace function aletes.save_favorite_order(
  p_id int, p_supplier_id int, p_name text, p_items jsonb
) returns int
language plpgsql security invoker as $$
declare v_id int;
begin
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'El pedido debe tener al menos un producto';
  end if;
  if p_id is null then
    insert into aletes.favorite_orders (supplier_id, name)
    values (p_supplier_id, trim(p_name))
    returning id into v_id;
  else
    update aletes.favorite_orders
       set name = trim(p_name)
     where id = p_id
    returning id into v_id;
    if not found then
      raise exception 'Pedido no encontrado';
    end if;
    delete from aletes.favorite_order_items where order_id = v_id;
  end if;
  insert into aletes.favorite_order_items (order_id, product_id, quantity)
  select v_id, (i ->> 'product_id')::int, (i ->> 'quantity')::numeric
    from jsonb_array_elements(p_items) i;
  return v_id;
end $$;

-- Recepción de un pedido: suma todas las cantidades al stock en una sola transacción.
-- p_items: [{"product_id": 1, "quantity": 6}, ...].
-- p_note / p_order_id: nombre e id del pedido favorito (quedan en el historial).
drop function if exists aletes.receive_order(jsonb);
drop function if exists aletes.receive_order(jsonb, text);
create or replace function aletes.receive_order(
  p_items jsonb, p_note text default null, p_order_id int default null
) returns setof aletes.products
language plpgsql security invoker as $$
begin
  perform set_config('aletes.mov_kind', 'order', true);
  perform set_config('aletes.mov_note', coalesce(left(trim(p_note), 120), ''), true);
  perform set_config('aletes.mov_order', coalesce(p_order_id::text, ''), true);
  if exists (select 1 from jsonb_array_elements(p_items) i
              where (i ->> 'quantity')::numeric <= 0) then
    raise exception 'Las cantidades deben ser mayores que 0';
  end if;
  return query
    update aletes.products p
       set quantity = p.quantity + i.quantity
      from (select (e ->> 'product_id')::int as product_id,
                   sum((e ->> 'quantity')::numeric) as quantity
              from jsonb_array_elements(p_items) e
             group by 1) i
     where p.id = i.product_id
    returning p.*;
  -- Que no se arrastre a otros cambios de la misma transacción.
  perform set_config('aletes.mov_kind', '', true);
  perform set_config('aletes.mov_note', '', true);
  perform set_config('aletes.mov_order', '', true);
end $$;

revoke execute on function aletes.save_favorite_order(int, int, text, jsonb) from public, anon;
grant execute on function aletes.save_favorite_order(int, int, text, jsonb) to authenticated;
revoke execute on function aletes.receive_order(jsonb, text, int) from public, anon;
grant execute on function aletes.receive_order(jsonb, text, int) to authenticated;

-- 5. Eventos ----------------------------------------------------------------------
-- Lo contrario de los pedidos: un evento CONSUME stock. Se apunta lo consumido
-- (event_items) y al «descontar» se resta del stock una sola vez (applied_at).
-- guests (comensales) es solo referencia para comparar eventos futuros.
create table if not exists aletes.events (
  id          serial primary key,
  name        varchar(120)  not null check (length(trim(name)) > 0),
  event_date  date          not null default current_date,
  guests      int           check (guests is null or guests >= 0),
  notes       varchar(500),
  -- Cuándo y quién descontó el consumo del stock (null = aún no descontado).
  applied_at  timestamptz,
  applied_by  varchar(255),
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

create index if not exists events_event_date_idx on aletes.events(event_date desc);

create table if not exists aletes.event_items (
  event_id    int           not null references aletes.events(id) on delete cascade,
  product_id  int           not null references aletes.products(id) on delete cascade,
  quantity    numeric(10,3) not null check (quantity > 0),
  primary key (event_id, product_id)
);

create index if not exists event_items_product_id_idx on aletes.event_items(product_id);

drop trigger if exists events_updated_at on aletes.events;
create trigger events_updated_at before update on aletes.events
  for each row execute function aletes.set_updated_at();

alter table aletes.events      enable row level security;
alter table aletes.event_items enable row level security;
drop policy if exists personal on aletes.events;
drop policy if exists personal on aletes.event_items;
create policy personal on aletes.events for all to authenticated
  using (aletes.es_personal()) with check (aletes.es_personal());
create policy personal on aletes.event_items for all to authenticated
  using (aletes.es_personal()) with check (aletes.es_personal());
revoke all on aletes.events, aletes.event_items from anon;
grant select, insert, update, delete on aletes.events, aletes.event_items to authenticated;
grant usage, select on all sequences in schema aletes to authenticated;

-- Reemplaza el consumo apuntado de un evento. No se puede tocar si ya se descontó.
-- p_items: [{"product_id": 1, "quantity": 3}, ...] (puede ir vacío).
create or replace function aletes.save_event_items(p_event_id int, p_items jsonb)
returns void
language plpgsql security invoker as $$
declare v_applied timestamptz;
begin
  select applied_at into v_applied from aletes.events where id = p_event_id for update;
  if not found then
    raise exception 'Evento no encontrado';
  end if;
  if v_applied is not null then
    raise exception 'Este evento ya se descontó del stock: su consumo no se puede cambiar';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
              where (i ->> 'quantity')::numeric <= 0) then
    raise exception 'Las cantidades deben ser mayores que 0';
  end if;
  delete from aletes.event_items where event_id = p_event_id;
  insert into aletes.event_items (event_id, product_id, quantity)
  select p_event_id, (i ->> 'product_id')::int, (i ->> 'quantity')::numeric
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i;
end $$;

-- Descuenta del stock todo el consumo del evento, de una vez y solo una vez.
-- Si algún producto no tiene stock suficiente, no se descuenta nada y se avisa de cuáles.
create or replace function aletes.consume_event(p_event_id int)
returns setof aletes.products
language plpgsql security invoker as $$
declare
  e       aletes.events;
  v_short text;
begin
  select * into e from aletes.events where id = p_event_id for update;
  if not found then
    raise exception 'Evento no encontrado';
  end if;
  if e.applied_at is not null then
    raise exception 'Este evento ya se descontó del stock';
  end if;
  if not exists (select 1 from aletes.event_items where event_id = p_event_id) then
    raise exception 'El evento no tiene consumo apuntado';
  end if;
  select string_agg(p.name || ' (hay ' || trim(to_char(p.quantity, 'FM999999990.###')) || ')',
                    ', ' order by p.name)
    into v_short
    from aletes.event_items i
    join aletes.products p on p.id = i.product_id
   where i.event_id = p_event_id and p.quantity < i.quantity;
  if v_short is not null then
    raise exception 'No hay stock suficiente de: %. Ajusta el stock o el consumo.', v_short;
  end if;

  perform set_config('aletes.mov_kind', 'event', true);
  perform set_config('aletes.mov_note', left(e.name, 120), true);
  perform set_config('aletes.mov_event', p_event_id::text, true);
  return query
    update aletes.products p
       set quantity = p.quantity - i.quantity
      from aletes.event_items i
     where i.event_id = p_event_id and p.id = i.product_id
    returning p.*;
  perform set_config('aletes.mov_kind', '', true);
  perform set_config('aletes.mov_note', '', true);
  perform set_config('aletes.mov_event', '', true);

  update aletes.events
     set applied_at = now(), applied_by = auth.jwt() ->> 'email'
   where id = p_event_id;
end $$;

revoke execute on function aletes.save_event_items(int, jsonb) from public, anon;
grant execute on function aletes.save_event_items(int, jsonb) to authenticated;
revoke execute on function aletes.consume_event(int) from public, anon;
grant execute on function aletes.consume_event(int) to authenticated;

-- 6. Historial de movimientos de stock -------------------------------------------
-- Cada cambio de `products.quantity` deja un registro, venga de donde venga (trigger).
-- Los toques de −/+ seguidos se AGRUPAN: si el último movimiento del producto es un
-- ajuste a mano de la misma persona hace menos de 2 minutos, se suma a ese registro en
-- vez de crear otro (10 toques de +1 = un "+10"). Si se compensa a 0, se borra.
-- Tipos: manual (−/+ y entradas/salidas: «Ajuste»), order (pedido de proveedor recibido),
-- event (consumo de un evento descontado), edit (cambio de cantidad desde la ficha del
-- producto: «Corrección»), create (alta con stock inicial).
-- order_id / event_id enlazan con el pedido o evento (note guarda su nombre por si se borran).
create table if not exists aletes.stock_movements (
  id             bigserial primary key,
  -- Si se borra el producto, el historial se conserva con su nombre.
  product_id     int           references aletes.products(id) on delete set null,
  product_name   varchar(120)  not null,
  unit           varchar(10)   not null,
  delta          numeric(10,3) not null,
  quantity_after numeric(10,3) not null,
  kind           varchar(10)   not null,
  note           varchar(120),
  user_email     varchar(255),
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now()
);

alter table aletes.stock_movements
  add column if not exists order_id int references aletes.favorite_orders(id) on delete set null,
  add column if not exists event_id int references aletes.events(id) on delete set null;
alter table aletes.stock_movements drop constraint if exists stock_movements_kind_check;
alter table aletes.stock_movements add constraint stock_movements_kind_check
  check (kind in ('manual', 'order', 'event', 'edit', 'create'));

create index if not exists stock_movements_event_idx on aletes.stock_movements(event_id);

-- Control lista por última actividad (updated_at) y pagina: índice en ese orden.
drop index if exists aletes.stock_movements_created_at_idx;
create index if not exists stock_movements_updated_at_idx
  on aletes.stock_movements(updated_at desc, id desc);
create index if not exists stock_movements_product_idx
  on aletes.stock_movements(product_id, updated_at desc);

-- security definer: escribe en el historial aunque el cliente solo tenga permiso de lectura.
create or replace function aletes.log_stock_movement() returns trigger
language plpgsql security definer set search_path = aletes, pg_temp as $$
declare
  v_delta numeric := new.quantity - (case when tg_op = 'INSERT' then 0 else old.quantity end);
  v_kind  text := coalesce(
    nullif(current_setting('aletes.mov_kind', true), ''),
    case when tg_op = 'INSERT' then 'create' else 'edit' end);
  v_note  text := nullif(current_setting('aletes.mov_note', true), '');
  v_order int  := nullif(current_setting('aletes.mov_order', true), '')::int;
  v_event int  := nullif(current_setting('aletes.mov_event', true), '')::int;
  v_email text := auth.jwt() ->> 'email';
  v_last  aletes.stock_movements;
begin
  if v_delta = 0 then
    return new;
  end if;

  if v_kind = 'manual' then
    -- Último movimiento del producto (de cualquier tipo): solo se agrupa si es el último.
    select * into v_last
      from aletes.stock_movements
     where product_id = new.id
     order by updated_at desc, id desc
     limit 1
       for update;
    if found
       and v_last.kind = 'manual'
       and v_last.user_email is not distinct from v_email
       and v_last.updated_at > now() - interval '2 minutes' then
      if v_last.delta + v_delta = 0 then
        delete from aletes.stock_movements where id = v_last.id;
      else
        update aletes.stock_movements
           set delta = delta + v_delta,
               quantity_after = new.quantity,
               updated_at = now()
         where id = v_last.id;
      end if;
      return new;
    end if;
  end if;

  insert into aletes.stock_movements
    (product_id, product_name, unit, delta, quantity_after, kind, note, user_email,
     order_id, event_id)
  values
    (new.id, new.name, new.unit, v_delta, new.quantity, v_kind, v_note, v_email,
     v_order, v_event);
  return new;
end $$;

drop trigger if exists products_log_stock on aletes.products;
create trigger products_log_stock after insert or update of quantity on aletes.products
  for each row execute function aletes.log_stock_movement();

revoke execute on function aletes.log_stock_movement() from public, anon, authenticated;

alter table aletes.stock_movements enable row level security;
drop policy if exists personal_lectura on aletes.stock_movements;
create policy personal_lectura on aletes.stock_movements for select to authenticated
  using (aletes.es_personal());
-- Solo lectura desde la app: el historial lo escribe el trigger.
revoke all on aletes.stock_movements from anon, authenticated;
grant select on aletes.stock_movements to authenticated;

-- 7. Empresa ---------------------------------------------------------------------
-- Datos básicos de la empresa (nombre, fiscales, contacto, logo). Hoy se usa una sola fila
-- (la de id más bajo), pero queda preparada por si la app algún día sirve a varias empresas
-- (entonces cada tabla llevaría su company_id y la RLS filtraría por él).
-- logo: imagen pequeña como data URL ('data:image/png;base64,…'); se sube desde Perfil.
-- Alta de la empresa (una vez): insert into aletes.companies (name) values ('Mi restaurante');
create table if not exists aletes.companies (
  id           serial primary key,
  name         varchar(120) not null check (length(trim(name)) > 0),
  legal_name   varchar(160),            -- razón social
  tax_id       varchar(20),             -- CIF / NIF
  email        varchar(255),
  phone        varchar(40),
  address      varchar(255),
  postal_code  varchar(10),
  city         varchar(80),
  province     varchar(80),
  country      varchar(80) not null default 'España',
  website      varchar(255),
  logo         text check (logo is null or (logo like 'data:image/%' and length(logo) < 500000)),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists companies_updated_at on aletes.companies;
create trigger companies_updated_at before update on aletes.companies
  for each row execute function aletes.set_updated_at();

alter table aletes.companies enable row level security;
drop policy if exists personal_lectura on aletes.companies;
drop policy if exists personal_edicion on aletes.companies;
create policy personal_lectura on aletes.companies for select to authenticated
  using (aletes.es_personal());
create policy personal_edicion on aletes.companies for update to authenticated
  using (aletes.es_personal()) with check (aletes.es_personal());
-- Desde la app se lee y se edita; dar de alta o borrar empresas es cosa del administrador.
revoke all on aletes.companies from anon, authenticated;
grant select, update on aletes.companies to authenticated;

-- 8. Acceso completo para service_role (panel de Supabase / scripts de administración)
grant all on all tables in schema aletes to service_role;
grant all on all sequences in schema aletes to service_role;
grant execute on all functions in schema aletes to service_role;
