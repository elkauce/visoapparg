// Servicios que se activan con una llamada GET (el resto recibe un POST con JSON)
const GET_STYLE_HOSTS = ["api-v3.voicemonkey.io", "api.voicemonkey.io"];

export function usesGetRequest(url: string): boolean {
  try {
    return GET_STYLE_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16) || 0,
    parseInt(value.slice(2, 4), 16) || 0,
    parseInt(value.slice(4, 6), 16) || 0,
  ];
}

// value1..value3 es el formato que lee IFTTT ("Receive a web request"). Home Assistant y otros leen el resto
export function buildWebhookPayload(statusName: string, color: string, off: boolean) {
  const rgb = hexToRgb(color).join(",");
  return {
    event: "status_changed",
    status: statusName,
    color,
    rgb,
    off,
    value1: color,
    value2: statusName,
    value3: rgb,
  };
}
