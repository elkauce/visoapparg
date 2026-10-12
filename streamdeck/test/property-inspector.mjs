import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { WebSocketServer } from "ws";
const { chromium } = await import(
  process.env.VISO_PLAYWRIGHT_MODULE || "playwright"
);
import { PRESETS, parseConfiguration } from "../src/configuration.mjs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const root = fileURLToPath(
  new URL("../com.viso.deck.sdPlugin/ui/", import.meta.url),
);
const http = createServer(async (req, res) => {
  const file = req.url.slice(1);
  if (
    ![
      "settings.html",
      "settings.css",
      "settings.js",
      "configuration.js",
    ].includes(file)
  ) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader(
    "Content-Type",
    file.endsWith(".html")
      ? "text/html"
      : file.endsWith(".css")
        ? "text/css"
        : "text/javascript",
  );
  res.end(await readFile(root + file));
});
await new Promise((r) => http.listen(0, "127.0.0.1", r));
const wss = new WebSocketServer({ port: 0 });
await new Promise((r) => wss.once("listening", r));
let configuration = null,
  writes = 0;
const settings = new Map();
wss.on("connection", (socket) =>
  socket.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.event === "sendToPlugin") {
      if (m.payload.type === "configuration") {
        configuration = parseConfiguration(m.payload.configuration);
        writes++;
      }
      socket.send(
        JSON.stringify({
          event: "sendToPropertyInspector",
          payload: { type: "configuration", configuration },
        }),
      );
    }
    if (m.event === "setSettings") settings.set(m.context, m.payload);
  }),
);
const browser = await chromium.launch({
  ...(process.env.VISO_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.VISO_CHROMIUM_EXECUTABLE }
    : {}),
  args: ["--no-sandbox"],
});
const pages = [];
let checks = 0;
const until = async (predicate) => {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("Inspector did not persist the expected settings");
};
async function open(action, context) {
  const page = await browser.newPage();
  pages.push(page);
  await page.goto(`http://127.0.0.1:${http.address().port}/settings.html`);
  await page.waitForFunction(
    () => typeof window.connectElgatoStreamDeckSocket === "function",
  );
  await page.evaluate(
    ({ port, action, context }) =>
      window.connectElgatoStreamDeckSocket(
        port,
        context,
        "registerPropertyInspector",
        "{}",
        JSON.stringify({ action, payload: { settings: {} } }),
      ),
    { port: wss.address().port, action, context },
  );
  return page;
}
try {
  const page = await open("com.viso.deck.libre", "libre-key");
  assert.equal(await page.locator("#heading").textContent(), "LIBRE");
  checks++;
  assert.equal(await page.locator("#state-field").isVisible(), false);
  checks++;
  const url = (id) =>
    `https://example.convex.site/deck/set?token=${"a".repeat(48)}&status=${id}`;
  const config = {
    format: "viso-streamdeck-v1",
    actions: [
      ...PRESETS.map((p) => ({ name: p.name, url: url(p.key) })),
      { name: "Pepe", url: url("personal") },
    ],
  };
  await page
    .locator("#file")
    .setInputFiles({
      name: "mi-viso.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(config)),
    });
  await page.waitForFunction(() =>
    document.getElementById("message").textContent.includes("Configurado"),
  );
  assert.equal(writes, 1);
  checks++;
  const custom = await open("com.viso.deck.state", "custom-key");
  await custom.waitForFunction(
    () => document.getElementById("state").options.length === 9,
  );
  await custom.locator("#state").selectOption("personal");
  await until(() => settings.get("custom-key")?.selectedStatus === "personal");
  assert.equal(settings.get("custom-key").label, "Pepe");
  assert.equal(writes, 1);
  checks += 2;
  await custom.locator("#label").fill("Jugando");
  await custom.locator("#label").press("Tab");
  await until(() => settings.get("custom-key")?.label === "Jugando");
  assert.equal(settings.get("custom-key").selectedStatus, "personal");
  checks++;
  const bad = {
    ...config,
    actions: [
      ...config.actions,
      {
        name: "Otra cuenta",
        url: url("other").replace("a".repeat(48), "b".repeat(48)),
      },
    ],
  };
  await custom
    .locator("#file")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(bad)),
    });
  await custom.waitForFunction(() =>
    document
      .getElementById("message")
      .textContent.includes("anterior se conserva"),
  );
  assert.equal(writes, 1);
  assert.deepEqual(configuration, config);
  checks += 2;
  console.log(
    JSON.stringify({
      passed: checks,
      scope:
        "Real Chromium property inspector with local Elgato protocol fixture: modules/CSP, preset control, one-time import, shared custom selection, label editing and rejected mixed accounts",
    }),
  );
} finally {
  await browser.close();
  for (const s of wss.clients) s.terminate();
  await new Promise((r) => wss.close(r));
  await new Promise((r) => http.close(r));
}
