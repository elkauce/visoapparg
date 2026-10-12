import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import streamDeck, { action, SingletonAction } from "@elgato/streamdeck";
import { activate } from "./request.mjs";
import {
  PRESETS,
  parseConfiguration,
  resolveControl,
} from "./configuration.mjs";
let configuration = null;
const instances = [];
class VisoState extends SingletonAction {
  pending = new Set();
  visible = new Map();
  constructor(preset = null) {
    super();
    this.preset = preset;
  }
  control(settings) {
    return this.preset?.statusId
      ? resolveControl(
          null,
          {
            ...settings,
            selectedStatus: this.preset.statusId,
            label: settings.label || this.preset.name,
          },
          configuration,
        )
      : resolveControl(this.preset, settings, configuration);
  }
  async render(key, settings) {
    let label = settings.label || this.preset?.name || "VISO\nConfigurar";
    try {
      label = this.control(settings).label;
    } catch {
      /* Keep a visible control; no fake URL. */
    }
    await key.setTitle(label);
    // Default images come from the manifest; retain icons personalized in Elgato.
  }
  async onWillAppear(ev) {
    this.visible.set(ev.action.id, {
      key: ev.action,
      settings: ev.payload.settings,
    });
    await this.render(ev.action, ev.payload.settings);
  }
  async onWillDisappear(ev) {
    this.visible.delete(ev.action.id);
  }
  async onDidReceiveSettings(ev) {
    this.visible.set(ev.action.id, {
      key: ev.action,
      settings: ev.payload.settings,
    });
    await this.render(ev.action, ev.payload.settings);
  }
  async onSendToPlugin(ev) {
    if (ev.payload?.type === "configuration") {
      try {
        const next = parseConfiguration(ev.payload.configuration);
        const existing = await streamDeck.settings.getGlobalSettings();
        await streamDeck.settings.setGlobalSettings({
          ...existing,
          configuration: next,
        });
        await receive({ configuration: next });
      } catch {
        await streamDeck.ui.sendToPropertyInspector({
          type: "error",
          message: "El archivo no es una configuración válida de VISO.",
        });
      }
    } else if (ev.payload?.type === "getConfiguration") {
      await streamDeck.ui.sendToPropertyInspector({
        type: "configuration",
        configuration,
      });
    }
  }
  async refresh() {
    await Promise.all(
      [...this.visible.values()].map(({ key, settings }) =>
        this.render(key, settings),
      ),
    );
  }
  async onKeyDown(ev) {
    if (this.pending.has(ev.action.id)) return;
    this.pending.add(ev.action.id);
    try {
      const control = this.control(ev.payload.settings);
      await activate(control.url);
      await ev.action.showOk();
    } catch {
      // No URLs, tokens or response bodies in logs.
      await ev.action.showAlert();
    } finally {
      this.pending.delete(ev.action.id);
    }
  }
}
function register(uuid, preset) {
  const Registered = action({ UUID: uuid })(
    class extends VisoState {
      constructor() {
        super(preset);
      }
    },
  );
  const instance = new Registered();
  instances.push(instance);
  streamDeck.actions.registerAction(instance);
}
let installerConfiguration = null;
try {
  installerConfiguration = parseConfiguration(
    JSON.parse(
      await readFile(new URL("../account.json", import.meta.url), "utf8"),
    ),
  );
} catch {
  /* Generic public installer. */
}
if (installerConfiguration) {
  installerConfiguration.actions.forEach((entry, index) =>
    register(
      `com.viso.deck.personal-${new URL(entry.url).searchParams.get("status")}`,
      {
        key: `personal-${index}`,
        name: entry.name,
        aliases: [entry.name],
        color: entry.color,
        statusId: new URL(entry.url).searchParams.get("status"),
      },
    ),
  );
}
register("com.viso.deck.state", null);
for (const preset of PRESETS) register(`com.viso.deck.${preset.key}`, preset);
const receive = async (settings) => {
  try {
    configuration = parseConfiguration(settings.configuration);
  } catch {
    configuration = null;
  }
  await Promise.all(instances.map((instance) => instance.refresh()));
  await streamDeck.ui.sendToPropertyInspector({
    type: "configuration",
    configuration,
  });
};
streamDeck.settings.useLegacySettingsBehavior = true;
streamDeck.settings.onDidReceiveGlobalSettings((ev) => {
  void receive(ev.settings);
});
streamDeck.logger.setLevel("warn");
await streamDeck.connect();
async function initialize() {
  const settings = await streamDeck.settings.getGlobalSettings();
  try {
    const contents = await readFile(
      new URL("../account.json", import.meta.url),
      "utf8",
    );
    const next = parseConfiguration(JSON.parse(contents));
    const fingerprint = createHash("sha256").update(contents).digest("hex");
    if (settings.installerFingerprint !== fingerprint) {
      const updated = {
        ...settings,
        configuration: next,
        installerFingerprint: fingerprint,
      };
      await streamDeck.settings.setGlobalSettings(updated);
      await receive(updated);
      return;
    }
  } catch {
    /* Public installer has no personal account; retain existing settings. */
  }
  await receive(settings);
}
void initialize().catch(() => undefined);
