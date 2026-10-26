// Convierte un SVG en PNG (fondo transparente) con el Chromium de Playwright.
//   node video/svg-a-png.mjs <entrada.svg> <salida.png> [tamaño=256]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const [input, output, size = '256'] = process.argv.slice(2);
if (!input || !output) {
  console.error('Uso: node video/svg-a-png.mjs entrada.svg salida.png [tamaño]');
  process.exit(1);
}
const px = Number(size);
const svg = readFileSync(input, 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: px, height: px } });
await page.setContent(
  `<html><body style="margin:0;background:transparent">
     <div id="logo" style="width:${px}px;height:${px}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
   </body></html>`,
);
await page.locator('#logo').screenshot({ path: output, omitBackground: true });
await browser.close();
console.log('PNG:', output);
