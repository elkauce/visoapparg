import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PRESETS,
  parseConfiguration,
  resolveControl,
} from "./configuration.mjs";
const url = (id) =>
  `https://example.convex.site/deck/set?token=${"a".repeat(48)}&status=${id}`;
const fixture = () => ({
  format: "viso-streamdeck-v1",
  actions: [
    ...PRESETS.slice(0, 6).map((p) => ({ name: p.name, url: url(p.key) })),
    { name: "Apagar", url: url("off") },
    { name: "Pepe", url: url("personal") },
  ],
});
test("one account configuration resolves all six states, off and a personal state", () => {
  const config = parseConfiguration(fixture());
  for (const p of PRESETS)
    assert.equal(resolveControl(p, {}, config).url, url(p.key));
  assert.equal(
    resolveControl(null, { selectedStatus: "personal" }, config).label,
    "Pepe",
  );
});
test("accents and meeting/call aliases refer to the real configured state and canonical names win", () => {
  const config = fixture();
  config.actions.unshift({ name: "En reunion", url: url("alias") });
  const preset = PRESETS.find((p) => p.key === "reunion");
  assert.equal(
    resolveControl(preset, {}, parseConfiguration(config)).url,
    url("reunion"),
  );
  config.actions = config.actions.filter((a) => a.name !== "REUNIÓN");
  assert.equal(
    resolveControl(preset, {}, parseConfiguration(config)).url,
    url("alias"),
  );
});
test("missing states or an unlinked account do not invent activation URLs", () => {
  assert.throws(() => resolveControl(PRESETS[0], {}, null));
  assert.throws(() =>
    resolveControl(
      PRESETS[0],
      {},
      parseConfiguration({
        format: "viso-streamdeck-v1",
        actions: [{ name: "Apagar", url: url("off") }],
      }),
    ),
  );
});
test("mixed account tokens, other backends and unsafe URLs cannot become shared configuration", () => {
  for (const other of [
    url("other").replace("a".repeat(48), "b".repeat(48)),
    url("other").replace("example.convex.site", "other.convex.site"),
    url("other").replace("https:", "http:"),
  ]) {
    assert.throws(() =>
      parseConfiguration({
        format: "viso-streamdeck-v1",
        actions: [
          { name: "Libre", url: url("libre") },
          { name: "Otra", url: other },
        ],
      }),
    );
  }
});
test("legacy per-key URLs and custom titles remain unchanged after shared configuration import", () => {
  const custom = url("old-key");
  assert.equal(
    resolveControl(
      null,
      { url: custom, label: "Mi tecla" },
      parseConfiguration(fixture()),
    ).url,
    custom,
  );
  assert.equal(
    resolveControl(
      PRESETS[0],
      { label: "Disponible" },
      parseConfiguration(fixture()),
    ).label,
    "Disponible",
  );
});
test("updating a shared account token updates preset and selected custom URLs without changing keys", () => {
  const first = parseConfiguration(fixture());
  const input = fixture();
  input.actions = input.actions.map((a) => ({
    ...a,
    url: a.url.replace("a".repeat(48), "b".repeat(48)),
  }));
  const second = parseConfiguration(input);
  assert.notEqual(
    resolveControl(PRESETS[0], {}, first).url,
    resolveControl(PRESETS[0], {}, second).url,
  );
  assert.equal(
    new URL(
      resolveControl(null, { selectedStatus: "personal" }, second).url,
    ).searchParams.get("token"),
    "b".repeat(48),
  );
});
