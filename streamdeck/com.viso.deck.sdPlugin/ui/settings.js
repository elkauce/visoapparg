import {
  PRESETS,
  parseConfiguration,
  resolveControl,
} from "./configuration.js";
let socket,
  context,
  actionId,
  settings = {},
  configuration = null;
const file = document.getElementById("file"),
  state = document.getElementById("state"),
  label = document.getElementById("label"),
  url = document.getElementById("url"),
  message = document.getElementById("message"),
  heading = document.getElementById("heading");
const preset = () => {
  const match = /^com\.viso\.deck\.personal-([a-z0-9-]+)$/.exec(actionId || "");
  const entry =
    match &&
    configuration?.actions.find(
      (entry) => new URL(entry.url).searchParams.get("status") === match[1],
    );
  return entry
    ? { name: entry.name, aliases: [entry.name], key: match[1] }
    : PRESETS.find((p) => actionId === `com.viso.deck.${p.key}`);
};
function send(event, payload) {
  if (socket?.readyState !== WebSocket.OPEN) {
    message.textContent = "Esperá la conexión con el programa Stream Deck.";
    return false;
  }
  socket.send(
    JSON.stringify({
      event,
      context,
      ...(event === "sendToPlugin" ? { action: actionId } : {}),
      payload,
    }),
  );
  return true;
}
function render() {
  const fixed = preset();
  document.getElementById("linking").hidden = Boolean(configuration);
  heading.textContent = fixed?.name || "Estado personalizado";
  document.getElementById("state-field").hidden = Boolean(fixed);
  state.replaceChildren(new Option("Elegí un estado", ""));
  for (const item of configuration?.actions ?? [])
    state.add(
      new Option(item.name, new URL(item.url).searchParams.get("status")),
    );
  state.value = settings.selectedStatus || "";
  label.value = settings.label || "";
  url.value = settings.url || "";
  try {
    resolveControl(fixed, settings, configuration);
    message.textContent =
      "Configurado. Pulsá la tecla para cambiar el estado en VISO.";
  } catch (failure) {
    message.textContent = failure.message;
  }
}
window.connectElgatoStreamDeckSocket = (
  port,
  uuid,
  registerEvent,
  info,
  actionInfo,
) => {
  context = uuid;
  const action = JSON.parse(actionInfo);
  actionId = action.action;
  settings = action.payload.settings || {};
  render();
  socket = new WebSocket("ws://127.0.0.1:" + port);
  socket.onopen = () => {
    socket.send(JSON.stringify({ event: registerEvent, uuid }));
    send("sendToPlugin", { type: "getConfiguration" });
  };
  socket.onmessage = (event) => {
    try {
      const input = JSON.parse(event.data);
      if (input.event === "didReceiveSettings") {
        settings = input.payload.settings || {};
        render();
      }
      if (input.event !== "sendToPropertyInspector") return;
      if (input.payload?.type === "configuration") {
        configuration = input.payload.configuration
          ? parseConfiguration(input.payload.configuration)
          : null;
        render();
      } else if (input.payload?.type === "error")
        message.textContent = input.payload.message;
    } catch {
      message.textContent =
        "No se pudo recuperar la configuración. Volvé a importar el archivo VISO.";
    }
  };
};
file.onchange = async () => {
  try {
    const input = file.files[0];
    if (!input || input.size > 65536) throw new Error();
    const next = parseConfiguration(JSON.parse(await input.text()));
    if (send("sendToPlugin", { type: "configuration", configuration: next }))
      message.textContent =
        "Guardando tu cuenta para todos los controles VISO…";
  } catch {
    message.textContent =
      "El archivo no es una configuración válida de VISO. La configuración anterior se conserva.";
  }
};
state.onchange = () => {
  if (!state.value) return;
  settings = {
    ...settings,
    selectedStatus: state.value,
    label: state.selectedOptions[0].textContent,
  };
  delete settings.url;
  if (send("setSettings", settings)) render();
};
label.onchange = () => {
  settings = { ...settings, label: label.value.trim() };
  send("setSettings", settings);
  render();
};
url.onchange = () => {
  const next = { ...settings, url: url.value.trim() };
  if (!next.url) delete next.url;
  try {
    resolveControl(preset(), next, configuration);
    settings = next;
    send("setSettings", settings);
    render();
  } catch {
    message.textContent =
      "Usá una URL personal válida del mismo servicio VISO.";
  }
};
