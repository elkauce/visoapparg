import { WebSocketServer } from "ws";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { PRESETS } from "../src/configuration.mjs";
import { readFile } from "node:fs/promises";
const manifest = JSON.parse(
  await readFile(
    new URL("../com.viso.deck.sdPlugin/manifest.json", import.meta.url),
  ),
);
const server = new WebSocketServer({ port: 0 });
await new Promise((resolve) => server.once("listening", resolve));
const info = {
  application: {
    version: "7.1.0",
    platform: "windows",
    platformVersion: "10.0",
    language: "es",
  },
  plugin: { uuid: "com.viso.deck", version: "1.1.0.0" },
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
};
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
    JSON.stringify(info),
  ],
  {
    cwd: fileURLToPath(new URL("../com.viso.deck.sdPlugin", import.meta.url)),
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  },
);
let errors = "",
  globals = {},
  checks = 0;
child.stderr.on("data", (data) => (errors += data));
const messages = [],
  requests = [];
child.on("message", (event) => {
  if (event.fixture === "http") requests.push(event);
});
const url = (id) =>
  `https://example.convex.site/deck/set?token=${"a".repeat(48)}&status=${id}`;
const configuration = {
  format: "viso-streamdeck-v1",
  actions: [
    ...PRESETS.map((p) => ({
      name: p.name,
      url: url(p.key === "off" ? "off" : `id-${p.key}`),
    })),
    { name: "Pepe", url: url("id-personal") },
  ],
};
try {
  const socket = await Promise.race([
    new Promise((resolve) => server.once("connection", resolve)),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Plugin connection timeout")), 5000),
    ),
  ]);
  socket.on("message", (data) => {
    const message = JSON.parse(data);
    messages.push(message);
    if (message.event === "getGlobalSettings")
      socket.send(
        JSON.stringify({
          event: "didReceiveGlobalSettings",
          context: message.context,
          payload: { settings: globals },
        }),
      );
    if (message.event === "setGlobalSettings") {
      globals = message.payload;
      socket.send(
        JSON.stringify({
          event: "didReceiveGlobalSettings",
          context: "test-plugin",
          payload: { settings: globals },
        }),
      );
    }
  });
  const wait = async (predicate, from = 0) => {
    for (let i = 0; i < 150; i++) {
      const found = messages.slice(from).find(predicate);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Missing plugin event; stderr length " + errors.length);
  };
  const event = (action, context, settings = {}, position = 0) => ({
    action,
    context,
    device: "test-device",
    payload: {
      settings,
      coordinates: { column: position % 5, row: Math.floor(position / 5) },
      controller: "Keypad",
      isInMultiAction: false,
    },
  });
  const press = async (base, expected) => {
    const offset = messages.length;
    socket.send(JSON.stringify({ ...base, event: "keyDown" }));
    await wait(
      (m) => m.event === expected && m.context === base.context,
      offset,
    );
    checks++;
  };
  await wait((m) => m.event === "registerPlugin");
  checks++;
  const keys = PRESETS.map((p, i) =>
    event(`com.viso.deck.${p.key}`, `key-${p.key}`, {}, i),
  );
  for (let i = 0; i < keys.length; i++) {
    const offset = messages.length;
    socket.send(JSON.stringify({ ...keys[i], event: "willAppear" }));
    assert.equal(
      (
        await wait(
          (m) => m.event === "setTitle" && m.context === keys[i].context,
          offset,
        )
      ).payload.title,
      PRESETS[i].name,
    );
    const actionManifest = manifest.Actions.find(
      (action) => action.UUID === keys[i].action,
    );
    assert.equal(actionManifest.States[0].Image, `imgs/${PRESETS[i].key}`);
    checks++;
  }
  await press(keys[0], "showAlert");
  assert.equal(requests.length, 0);
  checks++;
  socket.send(
    JSON.stringify({ ...keys[0], event: "propertyInspectorDidAppear" }),
  );
  let offset = messages.length;
  socket.send(
    JSON.stringify({
      action: keys[0].action,
      context: keys[0].context,
      event: "sendToPlugin",
      payload: { type: "configuration", configuration },
    }),
  );
  await wait((m) => m.event === "setGlobalSettings", offset);
  await wait(
    (m) =>
      m.event === "sendToPropertyInspector" &&
      m.payload?.configuration?.actions?.length === 8,
    offset,
  );
  assert.deepEqual(globals.configuration, configuration);
  checks++;
  for (let i = 0; i < keys.length; i++) {
    await press(keys[i], "showOk");
    assert.equal(
      requests.at(-1).status,
      PRESETS[i].key === "off" ? "off" : `id-${PRESETS[i].key}`,
    );
    checks++;
  }
  const custom = event(
    "com.viso.deck.state",
    "custom-key",
    { selectedStatus: "id-personal" },
    7,
  );
  offset = messages.length;
  socket.send(JSON.stringify({ ...custom, event: "willAppear" }));
  assert.equal(
    (
      await wait(
        (m) => m.event === "setTitle" && m.context === custom.context,
        offset,
      )
    ).payload.title,
    "Pepe",
  );
  await press(custom, "showOk");
  assert.equal(requests.at(-1).status, "id-personal");
  checks++;
  const legacy = event(
    "com.viso.deck.state",
    "legacy-key",
    { label: "OCUPADO", url: url("legacy-state") },
    8,
  );
  socket.send(JSON.stringify({ ...legacy, event: "willAppear" }));
  await press(legacy, "showOk");
  assert.equal(requests.at(-1).status, "legacy-state");
  checks++;
  const count = requests.length;
  offset = messages.length;
  socket.send(JSON.stringify({ ...keys[0], event: "keyDown" }));
  socket.send(JSON.stringify({ ...keys[0], event: "keyDown" }));
  await wait(
    (m) => m.event === "showOk" && m.context === keys[0].context,
    offset,
  );
  assert.equal(requests.length, count + 1);
  checks++;
  const saved = globals.configuration;
  offset = messages.length;
  socket.send(
    JSON.stringify({
      action: keys[0].action,
      context: keys[0].context,
      event: "sendToPlugin",
      payload: {
        type: "configuration",
        configuration: { format: "wrong", actions: [] },
      },
    }),
  );
  await wait(
    (m) => m.event === "sendToPropertyInspector" && m.payload?.type === "error",
    offset,
  );
  assert.deepEqual(globals.configuration, saved);
  checks++;
  assert.equal(errors.includes("token="), false);
  console.log(
    JSON.stringify({
      passed: checks,
      scope:
        "Bundled official SDK: preset controls, shared configuration, personal and legacy keys, click confirmation; WebSocket/HTTP fixtures, no physical hardware",
    }),
  );
} finally {
  child.kill();
  for (const socket of server.clients) socket.terminate();
  await new Promise((resolve) => server.close(resolve));
}
