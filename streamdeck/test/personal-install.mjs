import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";
import assert from "node:assert/strict";
const directory = await mkdtemp(join(tmpdir(), "viso-personal-plugin-"));
const configuration = {
  format: "viso-streamdeck-v1",
  actions: [
    {
      name: "Pepe",
      url: `https://example.convex.site/deck/set?token=${"a".repeat(48)}&status=owned-pepe`,
    },
  ],
};
await mkdir(join(directory, "bin"));
const manifest = JSON.parse(
  await readFile(
    new URL("../com.viso.deck.sdPlugin/manifest.json", import.meta.url),
  ),
);
const template = manifest.Actions.find((a) => a.UUID === "com.viso.deck.state");
manifest.Actions = [
  { ...template, UUID: "com.viso.deck.personal-owned-pepe", Name: "Pepe" },
  ...manifest.Actions,
];
await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
await writeFile(
  join(directory, "package.json"),
  JSON.stringify({ type: "module" }),
);
await copyFile(
  new URL("../com.viso.deck.sdPlugin/bin/plugin.mjs", import.meta.url),
  join(directory, "bin/plugin.mjs"),
);
await writeFile(join(directory, "account.json"), JSON.stringify(configuration));
const server = new WebSocketServer({ port: 0 });
await new Promise((r) => server.once("listening", r));
const child = spawn(
  process.execPath,
  [
    "--import",
    fileURLToPath(new URL("./fetch-fixture.mjs", import.meta.url)),
    "bin/plugin.mjs",
    "-port",
    String(server.address().port),
    "-pluginUUID",
    "test-plugin",
    "-registerEvent",
    "registerPlugin",
    "-info",
    JSON.stringify({
      application: {
        version: "7.1.0",
        platform: "windows",
        platformVersion: "10.0",
        language: "es",
      },
      plugin: { uuid: "com.viso.deck", version: "1.2.0.0" },
      devices: [
        {
          id: "test-device",
          name: "Stream Deck",
          type: 0,
          size: { columns: 5, rows: 3 },
        },
      ],
      colors: {},
      devicePixelRatio: 1,
    }),
  ],
  { cwd: directory, stdio: ["ignore", "pipe", "pipe", "ipc"] },
);
child.stderr.on("data", (data) => process.stderr.write(data));
let globals = {},
  requested = null;
const messages = [];
child.on("message", (m) => {
  if (m.fixture === "http") requested = m.status;
});
const deadline = setTimeout(() => {
  child.kill();
  server.close();
}, 8000);
try {
  const socket = await new Promise((r, j) => {
    server.once("connection", r);
    child.once("exit", () => j(new Error("Plugin exited before connecting")));
  });
  socket.on("message", (bytes) => {
    const m = JSON.parse(bytes);
    messages.push(m);
    if (m.event === "getGlobalSettings")
      socket.send(
        JSON.stringify({
          event: "didReceiveGlobalSettings",
          context: m.context,
          payload: { settings: globals },
        }),
      );
    if (m.event === "setGlobalSettings") {
      globals = m.payload;
      socket.send(
        JSON.stringify({
          event: "didReceiveGlobalSettings",
          context: m.context,
          payload: { settings: globals },
        }),
      );
    }
  });
  const wait = async (predicate) => {
    for (let i = 0; i < 200; i++) {
      if (predicate()) return;
      await new Promise((r) => setTimeout(r, 15));
    }
    throw new Error("Personal installer did not initialize");
  };
  await wait(() => globals.configuration);
  assert.deepEqual(globals.configuration, configuration);
  assert.ok(globals.installerFingerprint);
  const ev = {
    action: "com.viso.deck.personal-owned-pepe",
    context: "personal-key",
    device: "test-device",
    payload: {
      settings: {},
      coordinates: { column: 0, row: 0 },
      controller: "Keypad",
      isInMultiAction: false,
    },
  };
  socket.send(JSON.stringify({ ...ev, event: "willAppear" }));
  await wait(() =>
    messages.some((m) => m.event === "setTitle" && m.payload.title === "Pepe"),
  );
  socket.send(JSON.stringify({ ...ev, event: "keyDown" }));
  await wait(() => messages.some((m) => m.event === "showOk"));
  assert.equal(requested, "owned-pepe");
  console.log(
    "PASS: personal installer links account, registers owned control and activates its ID without file import or key configuration.",
  );
} finally {
  clearTimeout(deadline);
  child.kill();
  for (const s of server.clients) s.terminate();
  await new Promise((r) => server.close(r));
  await rm(directory, { recursive: true, force: true });
}
