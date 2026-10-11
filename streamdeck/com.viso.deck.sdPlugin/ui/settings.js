let socket, context, settings = {};
const file = document.getElementById('file'), state = document.getElementById('state'), label = document.getElementById('label'), url = document.getElementById('url'), message = document.getElementById('message');
function valid(value) { try { const u = new URL(value); return u.protocol === 'https:' && /^[a-z0-9-]+\.convex\.site$/.test(u.hostname) && !u.port && !u.username && !u.password && u.pathname === '/deck/set' && !u.hash && /^[a-f0-9]{48}$/.test(u.searchParams.get('token') || '') && Boolean(u.searchParams.get('status')); } catch { return false; } }
function save() {
  if (!valid(url.value)) { message.textContent = 'Importá una configuración o una URL válida de VISO.'; return; }
  settings = { url: url.value, label: label.value.trim() || 'VISO' };
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: 'setSettings', context, payload: settings }));
  message.textContent = 'Guardado. Pulsá la tecla para cambiar tu estado.';
}
window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, actionInfo) => {
  context = uuid;
  settings = JSON.parse(actionInfo).payload.settings || {};
  url.value = settings.url || ''; label.value = settings.label || '';
  socket = new WebSocket('ws://127.0.0.1:' + port);
  socket.onopen = () => socket.send(JSON.stringify({ event: registerEvent, uuid }));
};
file.onchange = async () => {
  try {
    const input = file.files[0]; if (!input || input.size > 65536) throw new Error();
    const config = JSON.parse(await input.text());
    if (config.format !== 'viso-streamdeck-v1' || !Array.isArray(config.actions) || !config.actions.length || config.actions.length > 25 || config.actions.some(a => typeof a.name !== 'string' || !valid(a.url))) throw new Error();
    state.replaceChildren(new Option('Elegí un estado', ''));
    for (const a of config.actions) state.add(new Option(a.name, a.url));
    message.textContent = 'Elegí el estado para esta tecla. Podés importar el mismo archivo en las demás.';
  } catch { message.textContent = 'El archivo no es una configuración válida de VISO.'; }
};
state.onchange = () => { if (!state.value) return; url.value = state.value; label.value = state.selectedOptions[0].textContent; save(); };
label.onchange = save; url.onchange = save;
