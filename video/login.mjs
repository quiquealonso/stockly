// Abre un Chromium VISIBLE con la app demo (http://localhost:4300) para que inicies sesión tú
// con el usuario demo. La sesión se guarda en video/.sesion-demo.json (ignorado por git) y la
// carga grabar.mjs. La contraseña la escribes tú; el script no la ve ni la guarda.
//
//   1) servidor demo en :4300 (lanzador "aletes-demo" o `npm --prefix frontend run ng -- serve --configuration demo`)
//   2) node video/login.mjs
import { chromium } from 'playwright';
import { APP, SESSION, TOKEN_KEY } from './config.mjs';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 420, height: 820 } });
const page = await context.newPage();
await page.goto(`${APP}/login`);
console.log('Inicia sesión con el usuario demo en la ventana que se ha abierto (tienes 5 minutos)…');
try {
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 5 * 60_000 });
  // Que supabase-js termine de guardar la sesión en localStorage.
  await page.waitForFunction((key) => (localStorage.getItem(key) ?? 'null') !== 'null', TOKEN_KEY);
  await context.storageState({ path: SESSION });
  console.log('Sesión guardada en video/.sesion-demo.json. Ya se puede grabar: node video/grabar.mjs');
} catch {
  console.log('No se ha detectado el inicio de sesión. Vuelve a ejecutarlo.');
  process.exitCode = 1;
} finally {
  await browser.close();
}
