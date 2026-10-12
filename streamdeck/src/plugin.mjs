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
  async render(key, settings) {
    let label = settings.label || this.preset?.name || "VISO\nConfigurar";
    try {
      label = resolveControl(this.preset, settings, configuration).label;
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
        await streamDeck.settings.setGlobalSettings({ configuration: next });
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
      const control = resolveControl(
        this.preset,
        ev.payload.settings,
        configuration,
      );
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
void streamDeck.settings
  .getGlobalSettings()
  .then(receive)
  .catch(() => undefined);
