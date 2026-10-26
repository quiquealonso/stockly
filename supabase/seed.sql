-- Datos de ejemplo (opcional), con una empresa ficticia. Ejecutar DESPUÉS de schema.sql.
-- Solo inserta si todavía no hay categorías.
do $$
declare
  bebidas int; carnes int; despensa int;
  norte int; sur int;
begin
  if exists (select 1 from aletes.categories) then
    raise notice 'Ya hay datos, no se ejecuta el seed.';
    return;
  end if;

  if not exists (select 1 from aletes.companies) then
    insert into aletes.companies (name, city) values ('Restaurante La Plaza', 'Valencia');
  end if;

  insert into aletes.categories (name, description)
    values ('Bebidas', 'Refrescos, aguas, cervezas y vinos') returning id into bebidas;
  insert into aletes.categories (name) values ('Carnes y pescados') returning id into carnes;
  insert into aletes.categories (name) values ('Despensa') returning id into despensa;

  insert into aletes.suppliers (name, phone) values ('Bebidas del Sur', '600 000 001') returning id into sur;
  insert into aletes.suppliers (name, phone) values ('Frescos del Norte', '600 000 002') returning id into norte;

  insert into aletes.products (name, unit, quantity, min_stock, category_id) values
    ('Agua mineral 50cl',            'BOTTLE', 48,  24, bebidas),
    ('Cerveza barril 30L',           'UNIT',    3,   2, bebidas),
    ('Vino tinto crianza',           'BOTTLE', 12,   6, bebidas),
    ('Solomillo de ternera',         'KG',     4.5,  2, carnes),
    ('Merluza',                      'KG',     1.2,  2, carnes),
    ('Aceite de oliva virgen extra', 'L',      15,   5, despensa),
    ('Arroz bomba',                  'KG',     8,    3, despensa),
    ('Huevos',                       'UNIT',   60,  30, despensa);

  -- Un producto puede tener varios proveedores (el aceite, aquí, los dos).
  insert into aletes.product_suppliers (product_id, supplier_id)
  select p.id, case when p.category_id = bebidas then sur else norte end
    from aletes.products p;
  insert into aletes.product_suppliers (product_id, supplier_id)
  select id, sur from aletes.products where name = 'Aceite de oliva virgen extra';
end $$;
