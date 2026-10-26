# Stockly en el móvil (APK con Capacitor)

La app no tiene servidor propio: el APK lleva el front de Angular y habla directamente con
Supabase. La seguridad la dan el **login** y las **políticas RLS** (`supabase/schema.sql`),
no el secreto del APK.

## Requisitos (una sola vez)

- **Android Studio** (trae el SDK de Android y un JDK). `npm run apk` crea
  `frontend/android/local.properties` apuntando al SDK si está en la ruta por defecto;
  si lo tienes en otro sitio, define `ANDROID_HOME` o edita ese archivo.
- Supabase configurado según el `README.md` y las claves en
  `frontend/src/environments/environment.ts`. **Las claves se meten en el APK al compilar**:
  si las cambias, vuelve a generarlo.

La carpeta `frontend/android/` ya está creada (`npx cap add android`) y el id de la app es
`com.aletes.stock` (`frontend/capacitor.config.json`).

## Generar el APK

Todo en un paso (compila en producción, copia la web a Android y genera el APK de debug):

```bash
cd frontend
npm run apk
```

Deja el archivo en `Stockly.apk`, en la raíz del proyecto.

Paso a paso, con Android Studio:

```bash
cd frontend
npm run apk:sync     # ng build + cap sync android
npm run apk:open     # abre Android Studio
```

En Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**. El archivo queda en
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

## Instalar

Pasa el APK al móvil (cable, Drive, Telegram…) y ábrelo; Android pedirá permitir
"instalar apps desconocidas". Para actualizar: `npm run apk` y reinstalar encima (se conserva la sesión).

## ¿Qué ve alguien que consiga el APK?

Solo la pantalla de login. El APK lleva la URL del proyecto y la clave `anon` (públicas); sin un
usuario creado en Supabase cuyo email esté en `es_personal()`, no se devuelve ningún dato.
