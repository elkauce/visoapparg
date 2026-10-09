#!/usr/bin/env node
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const helper = process.env.VISO_VALIDATION_HOME ?? "/workspace/.visoapparg-setup/android-validation";
const require = createRequire(path.join(helper, "browser-tools/package.json"));
const { PNG } = require("pngjs");
const pixelmatchModule = require("pixelmatch");
const pixelmatch = pixelmatchModule.default ?? pixelmatchModule;
const [directory = path.join(helper, "evidence"), baseline = "original", candidate = "android-web"] = process.argv.slice(2);
const originalReport = JSON.parse(await readFile(path.join(directory, `${baseline}-deck-report.json`), "utf8"));
const candidateReport = JSON.parse(await readFile(path.join(directory, `${candidate}-deck-report.json`), "utf8"));
const appearance = key => ({ label: key.label, background: key.background, color: key.color, border: key.border, shadow: key.shadow, radius: key.radius });
const report = {
  reference: baseline,
  candidate,
  keyCount: { reference: originalReport.keys.length, candidate: candidateReport.keys.length },
  originalKeyAppearancePreserved: JSON.stringify(originalReport.keys.map(appearance)) === JSON.stringify(candidateReport.keys.map(appearance)),
  fonts: { reference: originalReport.fonts, candidate: candidateReport.fonts },
  comparisons: [],
};
for (const orientation of ["landscape", "portrait"]) {
  const original = PNG.sync.read(await readFile(path.join(directory, `${baseline}-deck-${orientation}.png`)));
  const candidateImage = PNG.sync.read(await readFile(path.join(directory, `${candidate}-deck-${orientation}.png`)));
  if (original.width !== candidateImage.width || original.height !== candidateImage.height) throw new Error("Comparison requires the same viewport.");
  const difference = new PNG({ width: original.width, height: original.height });
  const changedPixels = pixelmatch(original.data, candidateImage.data, difference.data, original.width, original.height, { threshold: 0.1 });
  const totalPixels = original.width * original.height;
  const filename = `${candidate}-vs-${baseline}-${orientation}-diff.png`;
  await writeFile(path.join(directory, filename), PNG.sync.write(difference));
  report.comparisons.push({ orientation, width: original.width, height: original.height, changedPixels, totalPixels, changedPercent: Math.round(changedPixels / totalPixels * 10000) / 100, difference: filename });
}
await writeFile(path.join(directory, "deck-visual-comparison.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
