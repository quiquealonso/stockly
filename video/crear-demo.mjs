// Crea DESDE CERO el entorno demo del vídeo: esquema `aletes_demo` en el mismo proyecto de
// Supabase, generado a partir de supabase/schema.sql (mismas tablas, RLS y funciones).
// Borra y recrea el esquema cada vez: los datos reales (`aletes`) no se tocan.
//
//   node video/crear-demo.mjs <email-demo>      (o DEMO_EMAIL=… node video/crear-demo.mjs)
//
// Conexión a Postgres: fichero .env con DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_NAME.
// Por defecto ../campos/back/.env.supabase; otro con DB_ENV_FILE=ruta. Nunca se copia aquí.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = process.env.DB_ENV_FILE ?? join(ROOT, '..', 'campos', 'back', '.env.supabase');
const SCHEMA = 'aletes_demo';
const DEMO_EMAIL = (process.argv[2] ?? process.env.DEMO_EMAIL ?? '').trim().toLowerCase();
if (!DEMO_EMAIL) {
  console.error('Falta el email del usuario demo: node video/crear-demo.mjs demo@tu-dominio.com');
  process.exit(1);
}

// `pg` se toma de las dependencias de este mismo directorio (video/node_modules).
const require = createRequire(join(ROOT, 'video', 'package.json'));
const { Client } = require('pg');

const env = Object.fromEntries(
  readFileSync(ENV_FILE, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);

// Mismo esquema, otro nombre: todas las apariciones de `aletes` como identificador.
const sql = readFileSync(join(ROOT, 'supabase', 'schema.sql'), 'utf8').replace(/\baletes\b(?!_)/g, SCHEMA);

const client = new Client({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  await client.query(`drop schema if exists ${SCHEMA} cascade`);
  await client.query(sql);
  // En la demo solo entra el usuario demo.
  await client.query(`insert into ${SCHEMA}.staff (email) values ($1)`, [DEMO_EMAIL]);
  // Empresa recién dada de alta por el administrador: solo el nombre provisional.
  await client.query(`insert into ${SCHEMA}.companies (name) values ('Mi restaurante')`);
  // Que la API vea el esquema nuevo enseguida.
  await client.query(`notify pgrst, 'reload schema'`);
  const { rows } = await client.query(
    `select table_name from information_schema.tables where table_schema = $1 order by 1`,
    [SCHEMA],
  );
  console.log(`Esquema ${SCHEMA} creado desde cero para ${DEMO_EMAIL}:`, rows.map((r) => r.table_name).join(', '));
} finally {
  await client.end();
}
