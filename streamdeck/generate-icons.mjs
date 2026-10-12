const { chromium } = await import(
  process.env.VISO_PLAYWRIGHT_MODULE || "playwright"
);
import { PRESETS } from "./src/configuration.mjs";
import { fileURLToPath } from "node:url";
const browser = await chromium.launch({
  ...(process.env.VISO_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.VISO_CHROMIUM_EXECUTABLE }
    : {}),
  args: ["--no-sandbox"],
});
try {
  for (const preset of PRESETS) {
    for (const size of [72, 144]) {
      const page = await browser.newPage({
        viewport: { width: size, height: size },
        deviceScaleFactor: 1,
      });
      const heads =
        preset.key === "reunion"
          ? '<circle cx="40" cy="23" r="7"/><circle cx="20" cy="29" r="5"/><circle cx="60" cy="29" r="5"/>'
          : "";
      await page.setContent(
        `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 80 80"><rect x="1" y="1" width="78" height="78" rx="13" fill="#101218" stroke="${preset.color}" stroke-width="2"/><rect x="8" y="71" width="64" height="4" rx="2" fill="${preset.color}"/><g transform="translate(9 0) scale(.78)" stroke="${preset.color}" fill="none" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${heads}<path d="${preset.glyph}"/></g></svg>`,
      );
      await page.screenshot({
        path: fileURLToPath(
          new URL(
            `./com.viso.deck.sdPlugin/imgs/${preset.key}${size === 144 ? "@2x" : ""}.png`,
            import.meta.url,
          ),
        ),
        omitBackground: true,
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
