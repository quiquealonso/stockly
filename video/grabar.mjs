// Graba el vídeo de presentación: maneja la app demo sola (con datos de ejemplo creados en
// pantalla, partiendo de cero) dentro de un "escenario" 1280×720 con el móvil a la derecha y
// los rótulos a la izquierda. Empresa y datos FICTICIOS. Resultado: video/out/stockly-demo.webm
//
// Antes: node video/crear-demo.mjs  ·  servidor demo en :4300  ·  node video/login.mjs
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { APP, HERE, SESSION, TOKEN_KEY } from './config.mjs';

const OUT = join(HERE, 'out');
const RAW = join(OUT, 'crudo');
/** Capturas del final de cada escena, para revisar el vídeo sin reproducirlo. */
const SNAPS = join(OUT, 'capturas');
/** Logo de la empresa ficticia de la demo (se sube en Perfil). */
const LOGO = join(HERE, 'assets', 'logo-la-plaza.png');
/** Logo de Stockly (portada y cierre). */
const APP_LOGO = join(HERE, '..', 'docs', 'assets', 'stockly-logo.png');

if (!existsSync(SESSION)) {
  console.error('No hay sesión guardada del usuario demo. Ejecuta antes: node video/login.mjs');
  process.exit(1);
}

// --- Escenario (se sirve en el mismo origen que la app para compartir la sesión) ---------
const ESCENARIO = /* html */ `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Stockly</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  body { background: radial-gradient(circle at 30% 30%, #f1f8f7, #cfe4e0); color: #12312d; }
  .side { position: absolute; left: 80px; top: 0; bottom: 0; width: 640px;
    display: flex; flex-direction: column; justify-content: center; }
  .step { font-size: 18px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: #0f766e; margin-bottom: 14px; min-height: 22px; }
  h1 { font-size: 52px; line-height: 1.08; margin: 0 0 22px; }
  p { font-size: 25px; line-height: 1.45; margin: 0; color: #33514c; max-width: 600px; }
  .fade { transition: opacity .35s ease, transform .35s ease; }
  .hidden { opacity: 0; transform: translateY(12px); pointer-events: none; }
  .phone { position: absolute; right: 120px; top: 20px; width: 380px; height: 680px;
    border-radius: 46px; background: #1d1d1f; padding: 12px;
    box-shadow: 0 30px 70px rgba(18,49,45,.35); }
  .phone iframe { width: 356px; height: 656px; border: 0; border-radius: 36px; background: #f5f6f8; }
  .card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; background: radial-gradient(circle at 50% 40%, #f4faf9, #c7e0db);
    z-index: 10; }
  .card img { width: 170px; height: 170px; border-radius: 40px; margin-bottom: 26px;
    box-shadow: 0 16px 40px rgba(18,49,45,.3); }
  .card h1 { font-size: 64px; margin-bottom: 14px; }
  .card p { font-size: 28px; max-width: 900px; }
</style></head>
<body>
  <div class="side">
    <div class="step fade" id="step"></div>
    <h1 class="fade" id="title"></h1>
    <p class="fade" id="text"></p>
  </div>
  <div class="phone"><iframe id="app" src="about:blank"></iframe></div>
  <div class="card fade" id="card"><img id="cardLogo" alt="" style="display:none"><h1 id="cardTitle"></h1><p id="cardText"></p></div>
</body></html>`;

// --- Utilidades ----------------------------------------------------------------------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

for (const dir of [RAW, SNAPS]) {
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) rmSync(join(dir, f));
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  // Sesión guardada por login.mjs (solo se lee: el fichero no se modifica).
  storageState: SESSION,
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: RAW, size: { width: 1280, height: 720 } },
  locale: 'es-ES',
  timezoneId: 'Europe/Madrid',
});
await context.route(`${APP}/__escenario`, (route) =>
  route.fulfill({ contentType: 'text/html; charset=utf-8', body: ESCENARIO }),
);
const stage = await context.newPage();
await stage.goto(`${APP}/__escenario`);

/** El logo como data URL para la tarjeta final (fuera de la app). */
const logoData = 'data:image/png;base64,' + (await import('node:fs')).readFileSync(APP_LOGO).toString('base64');

let snapCount = 0;
async function snap() {
  const name = `${String(++snapCount).padStart(2, '0')}.png`;
  await stage.screenshot({ path: join(SNAPS, name) }).catch(() => undefined);
}

async function caption(step, title, text = '') {
  await snap();
  await stage.evaluate(
    async ([s, t, x]) => {
      const els = ['step', 'title', 'text'].map((id) => document.getElementById(id));
      els.forEach((e) => e.classList.add('hidden'));
      await new Promise((r) => setTimeout(r, 350));
      els[0].textContent = s;
      els[1].textContent = t;
      els[2].textContent = x;
      els.forEach((e) => e.classList.remove('hidden'));
    },
    [step, title, text],
  );
}

async function card(title, text, { logo = false, ms = 3500 } = {}) {
  await snap();
  await stage.evaluate(
    ([t, x, l]) => {
      document.getElementById('cardTitle').textContent = t;
      document.getElementById('cardText').textContent = x;
      const img = document.getElementById('cardLogo');
      img.style.display = l ? 'block' : 'none';
      if (l) img.src = l;
      document.getElementById('card').classList.remove('hidden');
    },
    [title, text, logo ? logoData : ''],
  );
  await wait(600);
  await snap();
  await wait(Math.max(0, ms - 600));
}

async function hideCard() {
  await stage.evaluate(() => document.getElementById('card').classList.add('hidden'));
  await wait(400);
}

const frameEl = stage.locator('#app');
const app = stage.frameLocator('#app');

/** Navega el móvil y marca los toques con un círculo (la grabación no muestra el cursor). */
async function go(path) {
  await frameEl.evaluate((el, url) => (el.src = url), `${APP}${path}`);
  await wait(1800);
  await installTapMarker();
}

async function installTapMarker() {
  const frame = stage.frames().find((f) => f.url().startsWith(APP) && !f.url().includes('__escenario'));
  await frame?.evaluate(() => {
    if (window.__tap) return;
    window.__tap = true;
    const style = document.createElement('style');
    style.textContent = `.__tap{position:fixed;z-index:99999;width:44px;height:44px;margin:-22px 0 0 -22px;
      border-radius:50%;background:rgba(15,118,110,.35);border:3px solid rgba(15,118,110,.8);
      pointer-events:none;animation:__tap .6s ease-out forwards}
      @keyframes __tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.4);opacity:0}}`;
    document.head.appendChild(style);
    document.addEventListener('pointerdown', (e) => {
      const d = document.createElement('div');
      d.className = '__tap';
      d.style.left = e.clientX + 'px';
      d.style.top = e.clientY + 'px';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 700);
    }, true);
  });
}

async function tap(locator, pause = 700) {
  await locator.scrollIntoViewIfNeeded();
  await wait(250);
  await locator.click();
  await wait(pause);
}

async function type(locator, text, pause = 350) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
  await locator.fill('');
  await locator.pressSequentially(text, { delay: 55 });
  await wait(pause);
}

const tab = (name) => app.locator('nav.tabbar a', { hasText: name });
const button = (name, exact = false) => app.getByRole('button', { name, exact });
const dialog = app.locator('[role=dialog]').last();
const confirmOk = (name) => app.locator('.confirm-actions button', { hasText: name });
const control = (name) => dialog.locator(`[formcontrolname=${name}]`);

/** Sesión cargada de .sesion-demo.json; se quita un momento para enseñar el login y se repone. */
let savedToken = null;
let tokenRemoved = false;

async function restoreToken() {
  if (!tokenRemoved || !savedToken) return;
  await stage.evaluate(([key, value]) => localStorage.setItem(key, value), [TOKEN_KEY, savedToken]);
  tokenRemoved = false;
}

savedToken = await stage.evaluate((key) => localStorage.getItem(key), TOKEN_KEY);
if (!savedToken || savedToken === 'null') {
  await browser.close();
  console.error('No hay sesión guardada del usuario demo. Ejecuta antes: node video/login.mjs');
  process.exit(1);
}

// --- Guion -----------------------------------------------------------------------------
try {
  // Portada
  await card('Stockly', 'Control de stock para restaurantes: almacén, proveedores, eventos y cada movimiento, en el bolsillo.', { logo: true, ms: 4500 });
  await go('/stock');
  await hideCard();

  // 1. Alta
  await caption('Paso 1 · Alta', 'Tu empresa, dada de alta', 'El administrador crea la empresa y da acceso a cada persona del equipo con su email. No hay registro abierto: solo entra quien está autorizado.');
  await wait(5500);

  // 2. Primer acceso
  await stage.evaluate((key) => localStorage.removeItem(key), TOKEN_KEY);
  tokenRemoved = true;
  await go('/login');
  await caption('Paso 2 · Primer acceso', 'Entra con tu email', 'Desde el móvil (app Android) o el navegador. La sesión se queda guardada.');
  await type(app.locator('input[type=email]'), 'equipo@restaurante-laplaza.es');
  await type(app.locator('input[type=password]'), 'demo-demo', 900);
  await restoreToken();
  await go('/stock');
  await caption('Paso 2 · Primer acceso', 'Todo vacío, listo para empezar', 'Lo primero: el perfil de la empresa, las categorías y los proveedores.');
  await wait(3000);

  // 3. Perfil
  await caption('Paso 3 · Perfil', 'Los datos de tu empresa', 'Nombre, CIF, contacto y el logo, que aparece arriba en toda la app.');
  await tap(tab('Perfil'), 1200);
  await tap(button('Editar'));
  await dialog.locator('input[type=file]').setInputFiles(LOGO);
  await wait(900);
  await type(control('name'), 'Restaurante La Plaza');
  await type(control('taxId'), 'B00000000');
  await type(control('phone'), '960 000 000');
  await type(control('city'), 'Valencia');
  await tap(button('Guardar'), 2200);

  // 4. Categorías
  await caption('Paso 4 · Categorías', 'Ordena tus productos', 'Bebidas, carnes, limpieza… cada producto va en una categoría.');
  await tap(tab('Categorías'), 1000);
  for (const name of ['Bebidas', 'Carnes', 'Limpieza']) {
    await tap(button('+ Nueva'));
    await type(control('name'), name, 200);
    await tap(button('Añadir'), 1300);
    await tap(app.getByRole('link', { name: '← Volver' }), 900);
  }

  // 5. Proveedores y productos
  await caption('Paso 5 · Proveedores', 'Quién te trae cada cosa', 'Cada proveedor con sus productos: unidad, stock mínimo y categoría.');
  await tap(tab('Proveedores'), 1000);
  await tap(button('+ Nuevo'));
  await type(control('name'), 'Bebidas del Sur');
  await type(control('phone'), '600 000 001');
  await tap(button('Añadir'), 1800);
  const products = [
    { name: 'Cerveza barril 30L', unit: 'Unidades', min: '2' },
    { name: 'Ron añejo', unit: 'Botellas', min: '3' },
    { name: 'Refresco de cola', unit: 'Unidades', min: '24' },
  ];
  for (const p of products) {
    await tap(app.locator('.block-head', { hasText: 'Productos' }).getByRole('button', { name: '+ Nuevo' }));
    await type(control('name'), p.name, 200);
    await control('categoryId').selectOption({ label: 'Bebidas' });
    await control('unit').selectOption({ label: p.unit });
    await type(control('minStock'), p.min, 200);
    await tap(button('Guardar'), 1200);
  }
  await wait(1200);

  // 6. Pedido favorito
  await caption('Paso 6 · Pedidos favoritos', 'Lo que pides siempre, a un toque', 'Guarda el pedido habitual con sus cantidades. Cuando llega la mercancía: «Recibido» y todo suma al stock de una vez.');
  await tap(app.getByRole('link', { name: '+ Nuevo' }), 1500);
  await type(app.locator('input[placeholder="Ej. Pedido semanal"]'), 'Pedido semanal');
  for (const [name, qty] of [['Cerveza barril 30L', '4'], ['Refresco de cola', '48'], ['Ron añejo', '6']]) {
    await type(app.getByLabel(`Cantidad de ${name}`), qty, 250);
  }
  await tap(button('Guardar'), 1800);
  await tap(app.locator('button.order', { hasText: 'Pedido semanal' }), 1800);
  await tap(button('Recibido: sumar'));
  await tap(confirmOk('Sumar al stock'), 2200);

  // 7. Stock del día a día
  await caption('Paso 7 · Stock', 'El día a día', 'Botones −/+ grandes para ir apuntando. Los toques seguidos se agrupan en un solo movimiento.');
  await tap(tab('Stock'), 1500);
  const cola = app.locator('li.item', { hasText: 'Refresco de cola' });
  for (let i = 0; i < 3; i++) await tap(cola.getByRole('button', { name: 'Restar 1' }), 600);
  await caption('Paso 7 · Stock', 'Entradas y salidas de cualquier cantidad', 'Toca el producto y apunta lo que entra o sale.');
  await tap(app.locator('li.item', { hasText: 'Ron añejo' }).locator('button.info'), 1000);
  await type(dialog.locator('input[inputmode=decimal]'), '2');
  await tap(dialog.getByRole('button', { name: '− Salida' }), 1800);
  await tap(app.locator('.segmented button', { hasText: 'Proveedores' }), 1800);

  // 8. Eventos
  await caption('Paso 8 · Eventos', 'Cada evento descuenta su consumo', 'Apunta lo que se consumió y descuéntalo del stock en un solo paso. Los comensales sirven de referencia para los próximos.');
  await tap(tab('Eventos'), 1000);
  await tap(button('+ Nuevo'));
  await type(control('name'), 'Boda García');
  await type(control('guests'), '120');
  await tap(button('Crear'), 1800);
  await tap(app.getByRole('link', { name: 'Apuntar consumo' }), 1600);
  for (const [name, qty] of [['Cerveza barril 30L', '2'], ['Refresco de cola', '30'], ['Ron añejo', '3']]) {
    await type(app.getByLabel(`Consumo de ${name}`), qty, 250);
  }
  await tap(button('Guardar'), 1800);
  await tap(button('Descontar del stock'));
  await tap(confirmOk('Descontar'), 2600);

  // 9. Control
  await caption('Paso 9 · Control', 'Todo queda registrado', 'Quién, cuándo, cuánto y por qué: pedido, ajuste o evento. Con buscador y filtros.');
  await tap(tab('Control'), 3000);
  await tap(app.locator('.chip', { hasText: 'Salidas' }), 1800);
  await tap(app.locator('.chip', { hasText: 'Todos' }), 1200);

  // 10. Qué falta
  await caption('Paso 10 · Bajo mínimos', 'Sabes qué pedir', 'De un vistazo, lo que está por debajo del mínimo. Y a pedir con tu pedido favorito.');
  await tap(tab('Stock'), 1200);
  await tap(app.locator('.low-toggle'), 3000);

  await card('Stockly', 'Stock, proveedores, eventos y control. Sencillo, en el móvil y siempre al día.', { logo: true, ms: 5000 });
} catch (e) {
  // Para depurar: cómo estaba la pantalla cuando falló.
  await stage.screenshot({ path: join(OUT, 'error.png') }).catch(() => undefined);
  throw e;
} finally {
  // Deja la sesión puesta y la guarda renovada (supabase-js refresca los tokens al cargar),
  // para que la próxima grabación no pida volver a iniciar sesión.
  await restoreToken().catch(() => undefined);
  const fresh = await stage.evaluate((key) => localStorage.getItem(key), TOKEN_KEY).catch(() => null);
  if (fresh && fresh !== 'null') await context.storageState({ path: SESSION }).catch(() => undefined);
  const video = stage.video();
  await context.close();
  await browser.close();
  const path = await video?.path();
  if (path) {
    const final = join(OUT, 'stockly-demo.webm');
    rmSync(final, { force: true });
    renameSync(path, final);
    console.log('Vídeo:', final);
  }
}
