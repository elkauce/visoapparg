/** Capture the real VISO components with labelled example data. Start Vite first. */
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
const origin = process.env.VISO_PAGE_PREVIEW_ORIGIN ?? "http://127.0.0.1:5193";
if (!["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) throw Error("Use the local capture fixture.");
const { chromium } = await import(process.env.VISO_PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(root, "public/marketplace");
await mkdir(resolve(output, "previews"), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.VISO_CHROMIUM_PATH ?? "/usr/bin/chromium", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const errors = [];
try {
  for (const kind of ["football", "clock", "weather", "spotify", "visualizer"]) {
    for (const vertical of [false, true]) {
      const page = await browser.newPage({ viewport: vertical ? { width: 390, height: 844 } : { width: 960, height: 600 }, deviceScaleFactor: 1 });
      page.on("pageerror", error => errors.push(`${kind}: ${error.message}`));
      await page.goto(`${origin}/scripts/page-previews/index.html?kind=${kind}`, { waitUntil: "networkidle" });
      await page.getByText(/CAPTURA DE VISO/).waitFor();
      await page.waitForTimeout(600);
      await page.screenshot({ path: resolve(output, `${vertical ? "previews" : "covers"}/page-${kind}${vertical ? "-vertical" : ""}.png`) });
      await page.close();
    }
  }
  if (errors.length) throw Error(errors.join("\n"));
} finally { await browser.close(); }
const manifestPath = resolve(output, "originals-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
async function files(directory) {
  const result = [];
  for (const name of await readdir(directory)) {
    const path = resolve(directory, name);
    if ((await stat(path)).isDirectory()) result.push(...await files(path));
    else if (path !== manifestPath) result.push(path);
  }
  return result;
}
manifest.generators = ["scripts/generate-marketplace-assets.py", "scripts/capture-marketplace-pages.mjs"];
manifest.files = await Promise.all((await files(output)).sort().map(async file => {
  const bytes = await readFile(file);
  return { path: relative(output, file), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}));
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("10 captures of actual VISO components, with labelled example data.");
