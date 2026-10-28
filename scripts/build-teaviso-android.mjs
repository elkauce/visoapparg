import { spawnSync } from "node:child_process";
import { readFile, mkdir, writeFile, copyFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  app = resolve(root, "apps/teaviso");
const local = process.argv.includes("--local-test"),
  webOnly = process.argv.includes("--web-only");
function localOrigin(key, fallback) {
  const value = process.env[key] || fallback;
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "10.0.2.2"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error(`Origen local inválido: ${key}`);
  return url.origin;
}
const backend = local
  ? localOrigin("TEAVISO_TEST_BACKEND", "http://127.0.0.1:3210")
  : "https://vivid-nightingale-785.convex.cloud";
const site = local
  ? localOrigin("TEAVISO_TEST_SITE", "http://127.0.0.1:3211")
  : "https://vivid-nightingale-785.convex.site";
const publicOrigin = local
  ? localOrigin("TEAVISO_TEST_PUBLIC_ORIGIN", "http://127.0.0.1:5218")
  : "https://teaviso-manuelhaguilar8-4981s-projects.vercel.app";
const configFile = resolve(app, "android/app/google-services.json");
let push = false;
try {
  await stat(configFile);
  const config = JSON.parse(await readFile(configFile, "utf8"));
  if (
    config.project_info?.project_id !== "viso-ad874" ||
    !config.client?.some(
      (client) =>
        client.client_info?.android_client_info?.package_name ===
        "com.teaviso.app",
    )
  )
    throw Error(
      "Usá google-services.json del proyecto viso-ad874 para el paquete com.teaviso.app.",
    );
  push = !process.argv.includes("--without-push");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const env = {
  ...process.env,
  VITE_TEAVISO_ANDROID: "true",
  VITE_CONVEX_URL: backend,
  VITE_CONVEX_SITE_URL: site,
  VITE_TEAVISO_PUBLIC_URL: publicOrigin,
  VITE_PUBLIC_APP_URL: publicOrigin,
  TEAVISO_ANDROID_LOCAL_TEST: local ? "1" : "0",
  TEAVISO_FCM_ENABLED: push ? "1" : "0",
};
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.execPath, [
  "node_modules/typescript/bin/tsc",
  "--project",
  "apps/teaviso/tsconfig.json",
]);
run(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "build",
  "--config",
  "apps/teaviso/vite.config.ts",
  "--outDir",
  "dist-android",
]);
if (webOnly) process.exit(0);
run(
  process.execPath,
  [
    resolve(root, "node_modules/@capacitor/cli/bin/capacitor"),
    "sync",
    "android",
  ],
  app,
);
const test = resolve(app, "android/app/src/localTest");
await mkdir(resolve(test, "res/xml"), { recursive: true });
await writeFile(
  resolve(test, "AndroidManifest.xml"),
  '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:networkSecurityConfig="@xml/local_test_network_security"/></manifest>\n',
);
await writeFile(
  resolve(test, "res/xml/local_test_network_security.xml"),
  '<network-security-config><base-config cleartextTrafficPermitted="false"/><domain-config cleartextTrafficPermitted="true"><domain>localhost</domain><domain>127.0.0.1</domain><domain>10.0.2.2</domain></domain-config></network-security-config>\n',
);
const task = local ? "assembleLocalTest" : "assembleDebug";
run(
  process.platform === "win32" ? "gradlew.bat" : "./gradlew",
  [task, ":app:testDebugUnitTest", "--max-workers=4", "--console=plain"],
  resolve(app, "android"),
);
const output = resolve(root, "artifacts/teaviso-android");
await mkdir(output, { recursive: true });
const variant = local ? "localTest" : "debug",
  name = local
    ? "Te-Aviso-local-test.apk"
    : push
      ? "Te-Aviso-1.0.1.apk"
      : "Te-Aviso-1.0.1-preview.apk";
await copyFile(
  resolve(app, `android/app/build/outputs/apk/${variant}/app-${variant}.apk`),
  resolve(output, name),
);
await writeFile(
  resolve(output, local ? "local-build.json" : "build.json"),
  JSON.stringify(
    {
      applicationId: "com.teaviso.app",
      name: "Te Aviso",
      versionName: "1.0.1",
      versionCode: 2,
      pushEnabled: push,
      localTest: local,
      backend,
      publicOrigin,
      filename: name,
      googleCallback: "com.teaviso.app://oauth/google",
      signing: "debug testing certificate",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Te Aviso APK: artifacts/teaviso-android/${name}; avisos Android: ${push ? "configurados, requieren prueba en celular" : "pendientes del archivo Firebase propio"}.`,
);
