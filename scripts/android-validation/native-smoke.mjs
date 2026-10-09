#!/usr/bin/env node
// Physical WebView interaction on an emulator using an APK with a local backend.
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const execFile = promisify(execFileCallback);
const helper = process.env.VISO_VALIDATION_HOME ?? "/workspace/.visoapparg-setup/android-validation";
const [apk, output = path.join(helper, "evidence")] = process.argv.slice(2);
if (!apk) throw new Error("Provide a local-backend validation APK; this script never tests mutations against production.");
await mkdir(output, { recursive: true });
const adbBinary = path.join(process.env.ANDROID_HOME ?? "/workspace/.visoapparg-setup/android-tools/sdk", "platform-tools/adb");
const adb = async (...arguments_) => (await execFile(adbBinary, ["-s", "emulator-5554", ...arguments_], { timeout: 60000, maxBuffer: 4 * 1024 * 1024 })).stdout.trim();
const report = { environment: "Android API 36 emulator, local Convex backend", checks: [], screenshots: [], errors: [] };
const authenticatedExpression = "Array.from(document.querySelectorAll('button')).some(b => /^(Salir|Cerrar sesión)$/.test(b.textContent.trim()))";
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const assert = (condition, label) => { if (!condition) throw new Error(label); report.checks.push({ check: label, passed: true }); };

// Check before installation that this is the local validation build.
await execFile("python3", ["-c", "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); scripts=[z.read(n) for n in z.namelist() if n.startswith('assets/public/assets/') and n.endswith('.js')]; assert any(b'http://127.0.0.1:3210' in b for b in scripts), 'APK must use loopback local backend for validation'", apk], { timeout: 30000 });
assert((await adb("shell", "getprop", "sys.boot_completed")) === "1", "Emulator completed boot");
await adb("reverse", "tcp:3210", "tcp:3210");
await adb("reverse", "tcp:3211", "tcp:3211");
const install = await adb("install", "-r", apk);
assert(install.includes("Success"), "APK installed successfully");
await adb("logcat", "-c");

class WebViewCDP {
  constructor(socket) {
    this.socket = socket;
    this.next = 0;
    this.pending = new Map();
    socket.addEventListener("message", event => {
      const result = JSON.parse(String(event.data));
      if (!result.id) return;
      const request = this.pending.get(result.id);
      if (!request) return;
      this.pending.delete(result.id);
      clearTimeout(request.timeout);
      if (result.error) request.reject(new Error(`CDP ${request.method} failed`));
      else request.resolve(result.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP ${method} timed out`)); }, 30000);
      this.pending.set(id, { resolve, reject, timeout, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error("WebView evaluation failed");
    return result.result?.value;
  }
  close() { this.socket.close(); }
}
async function attach() {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const pid = await adb("shell", "pidof", "com.viso.deck");
      if (!/^\d+$/.test(pid)) throw new Error("Application process not ready");
      await adb("forward", "tcp:9222", `localabstract:webview_devtools_remote_${pid}`);
      const targets = await fetch("http://127.0.0.1:9222/json", { signal: AbortSignal.timeout(5000) }).then(response => response.json());
      const page = targets.find(target => target.type === "page" && target.url.includes("localhost"));
      if (!page?.webSocketDebuggerUrl) throw new Error("WebView target not ready");
      const socket = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
      return new WebViewCDP(socket);
    } catch { await pause(1000); }
  }
  throw new Error("Cannot attach to the debug WebView");
}
let cdp;
async function waitFor(predicate, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await cdp.evaluate(predicate)) return; await pause(350); }
  throw new Error("Expected WebView state did not appear");
}
async function tap(selector) {
  const coordinates = await cdp.evaluate(`(() => { const element = ${selector}; if (!element) return null; const r = element.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  if (!coordinates) throw new Error("Touch target unavailable");
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [coordinates] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const button = label => `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)})`;
async function screenshot(name) {
  const data = await execFile(adbBinary, ["-s", "emulator-5554", "exec-out", "screencap", "-p"], { encoding: "buffer", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  await writeFile(path.join(output, name), data.stdout);
  report.screenshots.push(name);
}
async function launch() {
  await adb("shell", "am", "force-stop", "com.viso.deck");
  await adb("shell", "am", "start", "-W", "-n", "com.viso.deck/.MainActivity");
  cdp = await attach();
  await waitFor("document.querySelector('#root')?.textContent.trim().length > 0");
}

try {
  await launch();
  assert(await cdp.evaluate("location.origin === 'https://localhost' || location.origin === 'http://localhost'"), "App loads its bundled assets in the native WebView");
  await screenshot("android-home-start.png");
  const authenticated = await cdp.evaluate(authenticatedExpression);
  if (!authenticated) {
    await tap("Array.from(document.querySelectorAll('button')).find(b => /^(Entrar|Entrar al panel|Entrar o crear cuenta)$/.test(b.textContent.trim()))");
    await waitFor("Boolean(document.querySelector('input[name=email]'))");
    const credentials = JSON.parse(await readFile(path.join(helper, "account.private.json"), "utf8"));
    for (const name of ["email", "password"]) {
      await cdp.evaluate(`(() => { const input = document.querySelector('input[name=${name}]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(credentials[name])}); input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true})); })()`);
    }
    await tap("document.querySelector('[role=dialog] button[type=submit]')");
    await waitFor(`!document.querySelector('input[name=password]') && (${authenticatedExpression})`);
  }
  assert(true, "Own email/password account authenticates in the native WebView");
  const deckLink = "document.querySelector('a[href=\"/deck\"]')";
  await tap(deckLink);
  await waitFor("Array.from(document.querySelectorAll('main button')).some(b => b.textContent.trim() === 'Libre')");
  assert(await cdp.evaluate("document.querySelectorAll('main button').length >= 7"), "Original populated Deck keys appear");
  await tap(button("Ocupado"));
  await waitFor("getComputedStyle(Array.from(document.querySelectorAll('main button')).find(b => b.textContent.trim() === 'Ocupado')).backgroundColor === 'rgb(239, 68, 68)'");
  assert(true, "A touch activates Ocupado and its original red color");
  await adb("shell", "settings", "put", "system", "accelerometer_rotation", "0");
  await adb("shell", "settings", "put", "system", "user_rotation", "0");
  await pause(1500);
  await screenshot("android-deck-portrait.png");
  const beforeRotation = await cdp.evaluate("({width:innerWidth,height:innerHeight})");
  await adb("shell", "settings", "put", "system", "user_rotation", "1");
  await waitFor(`innerWidth !== ${beforeRotation.width} || innerHeight !== ${beforeRotation.height}`, 60000);
  assert(await cdp.evaluate("getComputedStyle(Array.from(document.querySelectorAll('main button')).find(b => b.textContent.trim() === 'Ocupado')).backgroundColor === 'rgb(239, 68, 68)'"), "Active state survives orientation change");
  await pause(1500);
  await screenshot("android-deck-landscape.png");
  cdp.close();
  await launch();
  await waitFor(authenticatedExpression);
  assert(!await cdp.evaluate("Boolean(document.querySelector('input[name=password]'))"), "Session survives force-stop and cold launch through native secure storage");
  await tap(deckLink);
  await waitFor("Array.from(document.querySelectorAll('main button')).some(b => b.textContent.trim() === 'Ocupado')");
  assert(await cdp.evaluate("getComputedStyle(Array.from(document.querySelectorAll('main button')).find(b => b.textContent.trim() === 'Ocupado')).backgroundColor === 'rgb(239, 68, 68)'"), "Active state persists after cold launch");
  await screenshot("android-deck-after-cold-start.png");
} catch (error) {
  report.errors.push(error.message);
  throw error;
} finally {
  cdp?.close();
  await adb("reverse", "tcp:3210", "tcp:3210").catch(() => {});
  await adb("reverse", "tcp:3211", "tcp:3211").catch(() => {});
  const log = await adb("logcat", "-d", "-v", "brief", "AndroidRuntime:E", "*:S").catch(() => "Logcat unavailable");
  report.fatalCrashFound = /FATAL EXCEPTION/.test(log);
  await writeFile(path.join(output, "android-runtime-errors.log"), log);
  await writeFile(path.join(output, "android-native-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
