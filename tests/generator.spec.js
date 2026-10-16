const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("carrega o aplicativo e os cinco tipos de bloco", async ({ page }) => {
  await expect(page).toHaveTitle(/Workout Round Timer/);
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#generate")).toBeVisible();
  await expect(page.locator("#manualPartType option")).toHaveText([
    "Circuito",
    "Exercício individual",
    "Combo",
    "Troca",
    "Descanso"
  ]);
});

test("gera um treino com quatro blocos", async ({ page }) => {
  await page.locator("#generate").click();
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator(".block")).toHaveCount(4);
  await expect(page.locator(".exercise")).toHaveCount(40);
});

test("Modo Play abre, avança, volta e fecha", async ({ page }) => {
  await page.locator("#generate").click();
  await page.locator("#openPlay").click();
  await expect(page.locator("#playOverlay")).toBeVisible();
  await expect(page.locator("#playCount")).toHaveText("ITEM 1 DE 40");
  await page.locator("#playNext").click();
  await expect(page.locator("#playCount")).toHaveText("ITEM 2 DE 40");
  await page.locator("#playPrev").click();
  await expect(page.locator("#playCount")).toHaveText("ITEM 1 DE 40");
  await page.locator("#closePlay").click();
  await expect(page.locator("#playOverlay")).toBeHidden();
});

test("montador manual adiciona circuito, troca e descanso", async ({ page }) => {
  const type = page.locator("#manualPartType");
  await type.selectOption("circuit");
  await page.locator("#manualAddPart").click();
  await expect(page.locator("#manualParts .builder-part")).toHaveCount(1);

  await type.selectOption("transition");
  await page.locator("#manualAddPart").click();
  await expect(page.locator("#manualParts .builder-part")).toHaveCount(2);
  await expect(page.locator("#manualParts")).toContainText("Troca");

  await type.selectOption("rest");
  await page.locator("#manualAddPart").click();
  await expect(page.locator("#manualParts .builder-part")).toHaveCount(3);
  await expect(page.locator("#manualParts")).toContainText("Descanso");
});

test("interface cabe na largura de um celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});
