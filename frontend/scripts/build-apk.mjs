// Genera el APK de debug y lo copia a ../Stockly.apk.
// Se lanza con `npm run apk` (después de `apk:sync`).
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const android = resolve(import.meta.dirname, '..', 'android');
const win = process.platform === 'win32';
const gradlew = resolve(android, win ? 'gradlew.bat' : 'gradlew');

// Sin ANDROID_HOME ni local.properties, Gradle no encuentra el SDK: usamos la ruta
// por defecto de Android Studio si existe.
const localProps = resolve(android, 'local.properties');
if (!process.env.ANDROID_HOME && !existsSync(localProps)) {
  const sdk = win
    ? resolve(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
    : resolve(process.env.HOME ?? '', process.platform === 'darwin' ? 'Library/Android/sdk' : 'Android/Sdk');
  if (existsSync(sdk)) writeFileSync(localProps, `sdk.dir=${sdk.replaceAll('\\', '\\\\')}\n`);
}

execSync(`"${gradlew}" assembleDebug`, { cwd: android, stdio: 'inherit' });

const apk = resolve(android, 'app/build/outputs/apk/debug/app-debug.apk');
const out = resolve(import.meta.dirname, '..', '..', 'Stockly.apk');
copyFileSync(apk, out);
console.log(`\nAPK listo: ${out}`);
