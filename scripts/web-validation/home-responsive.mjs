import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(
  process.env.VISO_PLAYWRIGHT_MODULE || "playwright"
);
const output = process.env.VISO_SCREENSHOT_DIR || "/tmp/viso-home-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.VISO_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
let checks = 0;
for (const width of [1440, 768, 390, 320]) {
  const page = await browser.newPage({
    viewport: { width, height: 950 },
    hasTouch: width < 768,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.VISO_REVIEW_URL || "http://localhost:5173/", {
    waitUntil: "networkidle",
  });
  await page.getByRole("group", { name: "Probar estados de VISO" }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  checks++;
  if (width < 768) {
    const hero = page.getByRole("region", { name: "Productos VISO" });
    await page
      .getByRole("button", { name: "Producto siguiente", exact: true })
      .click();
    await page.waitForTimeout(400);
    assert.equal(
      await page
        .getByRole("button", { name: "Mostrar VISO Display" })
        .getAttribute("aria-pressed"),
      "true",
    );
    checks++;
    for (const name of [
      "Ocupado",
      "Reunión",
      "Llamada",
      "No molestar",
      "Ausente",
      "Libre",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      assert.equal(
        await page
          .getByRole("button", { name, exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Mostrar VISO Display" })
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await hero.getAttribute("data-state-color"),
        await page
          .locator(".viso-landing")
          .evaluate((e) => e.style.getPropertyValue("--viso-demo-color")),
      );
      checks += 3;
    }
    await page.getByRole("button", { name: "Producto anterior" }).click();
    await page.waitForTimeout(400);
    assert.equal(
      await page
        .getByRole("button", { name: "Mostrar VISO Mini" })
        .getAttribute("aria-pressed"),
      "true",
    );
    checks++;
    await page.getByRole("button", { name: "Mostrar VISO Matrix" }).click();
    await page.waitForTimeout(400);
    assert.equal(
      await page
        .getByRole("button", { name: "Mostrar VISO Matrix" })
        .getAttribute("aria-pressed"),
      "true",
    );
    checks++;
    const rect = await hero.boundingBox();
    const session = await page.context().newCDPSession(page);
    const y = rect.y + 80,
      start = rect.x + rect.width * 0.75,
      end = rect.x + rect.width * 0.25;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start, y }],
    });
    for (let i = 1; i <= 12; i++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: start + ((end - start) * i) / 12, y }],
      });
      await page.waitForTimeout(16);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(600);
    assert.equal(
      await page
        .getByRole("button", { name: "Mostrar VISO Mini" })
        .getAttribute("aria-pressed"),
      "true",
    );
    checks++;
    assert.equal(
      await page
        .getByRole("button", { name: "Libre", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    checks++;
    await page
      .getByRole("button", { name: "Dispositivos", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Conocer VISO Display", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page
      .getByRole("dialog")
      .getByRole("heading", { name: "VISO Display" })
      .count(),
    1,
  );
  checks++;
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.waitForTimeout(250);
  await page
    .getByRole("button", {
      name: width < 768 ? "Entrar" : "Entrar al panel",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: "Entrar a VISO" })
    .waitFor();
  checks++;
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.waitForTimeout(250);
  assert.deepEqual(errors, []);
  checks++;
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: resolve(output, `home-${width}.png`),
    fullPage: true,
  });
  await page.close();
}
await browser.close();
console.log(`${checks} responsive and interaction checks passed`);
