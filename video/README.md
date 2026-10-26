# Vídeo de demostración

Vídeo de algo más de 2 minutos que enseña Stockly **partiendo de cero**, con una empresa
**ficticia** («Restaurante La Plaza», proveedor «Bebidas del Sur»). Lo graba sola la app, sin
voz y con rótulos en pantalla:

1. Portada.
2. Alta (rótulo).
3. Primer login.
4. Perfil: datos y logo de la empresa.
5. Categorías.
6. Proveedor con sus productos.
7. Pedido favorito recibido.
8. Stock del día a día.
9. Evento con su consumo descontado.
10. Control.
11. Bajo mínimos.
12. Cierre.

Resultado:
- `video/out/stockly-demo.webm` (1280×720, ignorado por git).
- Capturas del final de cada escena en `video/out/capturas/`, para revisarlo sin reproducirlo.
- La versión publicada en MP4, junto con su póster, está en `docs/media/`.

## Cómo se monta

- **Datos demo aparte**: el esquema `aletes_demo`, en el mismo proyecto de Supabase, se genera
  desde `supabase/schema.sql`. Los datos reales (`aletes`) no se tocan.
  - `crear-demo.mjs` borra y recrea el esquema cada vez, dejando solo una empresa provisional
    («Mi restaurante»).
  - Mete el email del usuario demo en `aletes_demo.staff`.
- **App demo**: `ng serve --configuration demo` (puerto 4300; lanzador «aletes-demo»). Usa
  `environment.demo.ts`, que es `environment.local.ts` con el esquema `aletes_demo`.
- **Grabación**: Playwright (`grabar.mjs`) carga un «escenario» de 1280×720, con el móvil a la
  derecha (la app en un iframe de 356 px de ancho) y los rótulos a la izquierda, y graba la
  pantalla.
  - Los toques se marcan con un círculo, porque la grabación no muestra el cursor.
  - En la escena de login escribe un email y una contraseña de relleno, pero **no los envía**:
    entra con la sesión guardada.
- **Logos**: `assets/logo-la-plaza.svg` (la empresa ficticia, que se sube en Perfil) y
  `../docs/assets/stockly-logo.svg` (portada y cierre). Para pasarlos a PNG:
  `node video/svg-a-png.mjs entrada.svg salida.png 256`.

## Volver a grabarlo

Una sola vez:

1. En Supabase, *Settings › Data API › Exposed schemas*: añadir `aletes_demo`.
2. Crear un usuario demo en *Authentication › Users*, con *Auto Confirm*.
3. Instalar las dependencias: `cd video && npm install && npx playwright install chromium`.
4. Tener `frontend/src/environments/environment.local.ts` configurado (ver el README principal).

Cada vez:

```bash
# 1) servidor demo en :4300 (lanzador "aletes-demo", o:)
npm --prefix frontend run ng -- serve --configuration demo
# 2) datos desde cero (DB_ENV_FILE=ruta/.env con DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
node video/crear-demo.mjs demo@tu-dominio.com
# 3) iniciar sesión con el usuario demo (solo la primera vez o si la sesión caduca)
node video/login.mjs
# 4) grabar
node video/grabar.mjs
# 5) MP4 para publicar (ffmpeg)
ffmpeg -i video/out/stockly-demo.webm -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart -an docs/media/stockly-demo.mp4
```

- La sesión se guarda en `video/.sesion-demo.json`, ignorado por git. Cada grabación la guarda
  renovada al terminar. **La contraseña la escribe una persona en `login.mjs`; ningún script la
  guarda.**
- Si la grabación falla, deja `video/out/error.png` con la pantalla del momento del fallo.
- Para cambiar el guion (textos, datos, ritmo), edita `grabar.mjs`. Cada escena es un `caption(...)`
  seguido de toques (`tap`) y textos escritos (`type`).
