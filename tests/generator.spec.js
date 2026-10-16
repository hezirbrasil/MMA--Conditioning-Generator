const { test, expect } = require("@playwright/test");

test("carrega a interface e os cinco tipos de bloco", async ({ page }) => {
  await page.goto("/");
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

test("a interface não cria rolagem horizontal no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});
