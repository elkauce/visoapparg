#!/usr/bin/env node
// Runs only against a local Convex backend. Accounts and tokens stay outside Git.
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import path from "node:path";

const helper = process.env.VISO_VALIDATION_HOME ?? "/workspace/.visoapparg-setup/android-validation";
const require = createRequire(path.join(helper, "browser-tools/package.json"));
const { chromium } = require("playwright");
const [origin = "http://127.0.0.1:5175", label = "original", output = path.join(helper, "evidence")] = process.argv.slice(2);
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
  throw new Error("Validation is restricted to a loopback frontend and local backend.");
}
await mkdir(helper, { recursive: true });
await mkdir(output, { recursive: true });
let credentials;
try {
  credentials = JSON.parse(await readFile(path.join(helper, "account.private.json"), "utf8"));
} catch {
  credentials = { email: `android-validation-${randomBytes(6).toString("hex")}@example.invalid`, password: randomBytes(24).toString("base64url"), created: false };
  await writeFile(path.join(helper, "account.private.json"), JSON.stringify(credentials), { mode: 0o600 });
}
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: "dark", reducedMotion: "reduce" });
// Resolve the original Google Fonts stylesheet to the same bundled font faces.
// This changes no colors, layout or components and avoids a fallback-font comparison.
const referenceFontCss = (await readFile(new URL("../../src/fonts.css", import.meta.url), "utf8")).replaceAll('url("/fonts/', `url("${origin}/fonts/`);
await context.route("https://fonts.googleapis.com/**", route => route.fulfill({ status: 200, contentType: "text/css", headers: { "access-control-allow-origin": "*" }, body: referenceFontCss }));
await context.route("**/*", route => {
  const hostname = new URL(route.request().url()).hostname;
  return /\.convex\.(cloud|site)$/.test(hostname) ? route.abort("blockedbyclient") : route.fallback();
});
await context.routeWebSocket(/wss:\/\/[^/]+\.convex\.cloud\//, socket => socket.close({ reason: "Cloud backends excluded from local validation" }));
const page = await context.newPage();
const findings = { label, origin, backend: "local", errors: [], checks: [], screenshots: [] };
page.on("pageerror", error => findings.errors.push(error.message));
try {
await page.goto(origin, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Entrar( al panel)?$/ }).first().click();
if (!credentials.created) await page.getByRole("button", { name: "Crear una cuenta", exact: true }).click();
await page.getByLabel("Correo electrónico").fill(credentials.email);
await page.getByLabel("Contraseña", { exact: true }).fill(credentials.password);
await page.getByRole("dialog").getByRole("button", { name: credentials.created ? "Entrar" : "Crear cuenta", exact: true }).click();
await page.getByRole("button", { name: "Salir", exact: true }).first().waitFor({ timeout: 30000 });
credentials.created = true;
await writeFile(path.join(helper, "account.private.json"), JSON.stringify(credentials), { mode: 0o600 });
const initialize = page.getByRole("button", { name: "Cargar estados básicos", exact: true });
if (await initialize.isVisible()) await initialize.click();
await page.getByText("Libre", { exact: true }).first().waitFor({ timeout: 30000 });
findings.checks.push({ check: "Email/password authentication with local backend", passed: true });
await page.goto(`${origin}/deck`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Libre", exact: true }).waitFor({ timeout: 30000 });
await page.getByRole("button", { name: "Libre", exact: true }).click();
await page.waitForTimeout(400);
await page.evaluate(() => document.fonts.ready);
findings.fonts = await page.evaluate(() => ({ family: getComputedStyle(document.body).fontFamily, loadedFaces: Array.from(document.fonts).map(font => ({ family: font.family, status: font.status })) }));
const cdp = await context.newCDPSession(page);
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
const documentNode = await cdp.send("DOM.getDocument");
const keyText = await cdp.send("DOM.querySelector", { nodeId: documentNode.root.nodeId, selector: "main button span" });
findings.fonts.rendered = (await cdp.send("CSS.getPlatformFontsForNode", { nodeId: keyText.nodeId })).fonts;
findings.keys = await page.locator("main button").evaluateAll(nodes => nodes.map(node => {
  const style = getComputedStyle(node);
  const rectangle = node.getBoundingClientRect();
  return { label: node.textContent?.trim() ?? "", background: style.backgroundColor, color: style.color, border: style.borderColor, shadow: style.boxShadow, radius: style.borderRadius, bounds: { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height } };
}));
for (const viewport of [{ name: "landscape", width: 1280, height: 720 }, { name: "portrait", width: 720, height: 1280 }]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.waitForTimeout(400);
  const filename = `${label}-deck-${viewport.name}.png`;
  await page.screenshot({ path: path.join(output, filename), fullPage: false, animations: "disabled" });
  findings.screenshots.push({ file: filename, width: viewport.width, height: viewport.height });
}
await context.storageState({ path: path.join(helper, `${label}.storage.private.json`) });
await chmod(path.join(helper, `${label}.storage.private.json`), 0o600);
} catch (error) {
  findings.errors.push(error.message.replaceAll(credentials.email, "[test account]").replaceAll(credentials.password, "[redacted]"));
  process.exitCode = 1;
} finally {
await browser.close();
}
await writeFile(path.join(output, `${label}-deck-report.json`), JSON.stringify(findings, null, 2));
console.log(JSON.stringify({ label, checks: findings.checks, keyCount: findings.keys?.length, errors: findings.errors, screenshots: findings.screenshots, fonts: findings.fonts }));
