/** The repository's ESP32 example reads this feed without a return channel. */
export type VisoStatusFeeds = {
  rgb: string;
  hex: string;
  name: string;
  json: string;
};

export function getVisoStoreUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function buildVisoStatusFeeds(
  siteUrl: string,
  slug: string,
): VisoStatusFeeds | null {
  if (!slug) return null;
  try {
    const url = new URL("/public/status", siteUrl);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    url.searchParams.set("slug", slug);
    const json = url.toString();
    const format = (value: string) => {
      const formatted = new URL(json);
      formatted.searchParams.set("format", value);
      return formatted.toString();
    };
    return {
      rgb: format("rgb"),
      hex: format("hex"),
      name: format("name"),
      json,
    };
  } catch {
    return null;
  }
}

/** Confirms the VISO feed, never that a physical device received its color. */
export async function readVisoRgbStatus(
  url: string,
): Promise<readonly [number, number, number]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error("VISO no pudo consultar el color. Inténtalo de nuevo.");
    const values = (await response.text()).trim().split(",");
    if (
      values.length !== 3 ||
      values.some((value) => !/^\d{1,3}$/.test(value) || Number(value) > 255)
    ) {
      throw new Error("La respuesta de color no es compatible.");
    }
    return values.map(Number) as [number, number, number];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("La consulta tardó demasiado. Revisa tu conexión.", {
        cause: error,
      });
    }
    if (error instanceof TypeError) {
      throw new Error("No se pudo consultar VISO. Revisa tu conexión.", {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
