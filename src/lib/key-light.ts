export type KeyLightSetting = {
  on: boolean;
  brightness: number;
  temperature: number;
};

// Rango real de la Key Light (temperatura en "mired": 143 = 7000K frío, 344 = 2900K cálido)
export const LIGHT_LIMITS = {
  minBrightness: 3,
  maxBrightness: 100,
  minKelvin: 2900,
  maxKelvin: 7000,
} as const;

export const DEFAULT_LIGHT: KeyLightSetting = {
  on: true,
  brightness: 60,
  temperature: 200,
};

export function temperatureToKelvin(temperature: number): number {
  return Math.round(1_000_000 / temperature / 50) * 50;
}

export function kelvinToTemperature(kelvin: number): number {
  return Math.round(1_000_000 / kelvin);
}

// La Key Light escucha en el puerto 9123 de la red local. La llamada sale del navegador del usuario,
// porque el servidor de VISO no puede ver su red local
export async function applyKeyLight(
  host: string,
  light: KeyLightSetting,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`http://${host}:9123/elgato/lights`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numberOfLights: 1,
        lights: [
          {
            on: light.on ? 1 : 0,
            brightness: light.brightness,
            temperature: light.temperature,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`La luz respondió ${response.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
