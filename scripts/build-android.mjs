import { spawnSync } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localTest = process.argv.includes("--local-test");
const webOnly = process.argv.includes("--web-only");
const backend = process.env.VISO_ANDROID_CONVEX_URL ?? (localTest ? "http://127.0.0.1:3210" : "https://vivid-nightingale-785.convex.cloud");
const site = process.env.VISO_ANDROID_CONVEX_SITE_URL ?? (localTest ? "http://127.0.0.1:3211" : "https://vivid-nightingale-785.convex.site");
const allowedTestHosts = new Set(["10.0.2.2", "127.0.0.1", "localhost"]);
const extensions = localTest ? "true" : (process.env.VISO_ANDROID_DECK_EXTENSIONS ?? (backend === "https://useful-egret-915.convex.cloud" ? "false" : "true"));
if (backend === "https://useful-egret-915.convex.cloud" && extensions === "true") {
  throw new Error("The current production backend does not expose the Android extension APIs.");
}
for (const value of [backend, site]) {
  const url = new URL(value);
  if (url.username || url.password || (localTest ? !allowedTestHosts.has(url.hostname) : url.protocol !== "https:")) {
    throw new Error("Android requires HTTPS endpoints; local-test accepts only loopback/emulator hosts.");
  }
}
const env = {
  ...process.env,
  VITE_CONVEX_URL: backend,
  VITE_CONVEX_SITE_URL: site,
  // Branch-only APIs are never enabled against the existing production backend.
  VITE_ANDROID_DECK_EXTENSIONS: extensions,
  VITE_ANDROID_PREVIEW: "true",
  VITE_VISO_WEB_URL: process.env.VISO_ANDROID_WEB_URL ?? "",
  VISO_ANDROID_LOCAL_TEST: localTest ? "1" : "0",
};
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.execPath, ["node_modules/typescript/bin/tsc", "-b"]);
run(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--mode", "android"]);
if (webOnly) process.exit(0);
run(process.execPath, ["node_modules/@capacitor/cli/bin/capacitor", "sync", "android"]);

// A separate, ignored source set permits HTTP only for local emulator validation.
const testSource = resolve(root, "android/app/src/localTest");
await mkdir(resolve(testSource, "res/xml"), { recursive: true });
await writeFile(resolve(testSource, "AndroidManifest.xml"), '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:networkSecurityConfig="@xml/local_test_network_security" /></manifest>\n');
await writeFile(resolve(testSource, "res/xml/local_test_network_security.xml"), '<network-security-config><base-config cleartextTrafficPermitted="false"/><domain-config cleartextTrafficPermitted="true"><domain>10.0.2.2</domain><domain>127.0.0.1</domain><domain>localhost</domain></domain-config></network-security-config>\n');
const task = localTest ? "assembleLocalTest" : "assembleDebug";
run(process.platform === "win32" ? "gradlew.bat" : "./gradlew", [task, "--max-workers=4", "--console=plain"], resolve(root, "android"));
const outputDir = resolve(root, "artifacts/android");
await mkdir(outputDir, { recursive: true });
const variant = localTest ? "localTest" : "debug";
const filename = localTest ? "VISO-Deck-local-test.apk" : "VISO-Deck-debug.apk";
await copyFile(resolve(root, `android/app/build/outputs/apk/${variant}/app-${variant}.apk`), resolve(outputDir, filename));
console.log(`Android APK: artifacts/android/${filename}`);
