// Never log account URLs: they contain the user's revocable Deck token.
export function parseActionUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.convex\.site$/.test(url.hostname) || url.port || url.username || url.password || url.pathname !== '/deck/set' || url.hash) throw new Error('Configuración inválida');
  const token = url.searchParams.get('token');
  const status = url.searchParams.get('status');
  if (!/^[a-f0-9]{48}$/.test(token ?? '') || !status || status.length > 200) throw new Error('Configuración incompleta');
  return url;
}
export async function activate(value, fetcher = fetch) {
  const url = parseActionUrl(value);
  const response = await fetcher(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 ? 'Renová tu configuración en VISO' : 'VISO no confirmó el estado');
  const body = await response.json();
  if (body.ok !== true) throw new Error('VISO no confirmó el estado');
}
