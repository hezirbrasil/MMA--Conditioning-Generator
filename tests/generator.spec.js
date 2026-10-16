const { test, expect } = require("@playwright/test");

test("carrega a interface e os cinco tipos de bloco", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Workout Round Timer/);
  await expect(page.locator("#manualPartType option")).toHaveText([
    "Circuito",
    "Exercício individual",
    "Combo",
    "Troca",
    "Descanso"
  ]);
});

test("botão Adicionar parte cria os blocos do montador manual", async ({ page }) => {
  await page.goto("/");
  const typeSelect = page.locator("#manualPartType");
  const addButton = page.locator("#manualAddPart");
  const parts = page.locator("#manualParts .builder-part");

  for (const [value, expected] of [
    ["circuit", "Circuito funcional"],
    ["individual", "Exercício individual"],
    ["fight", "Combo"],
    ["transition", "Troca para luta"],
    ["rest", "Descanso"]
  ]) {
    await typeSelect.selectOption(value);
    await addButton.click();
    await expect(parts).toHaveCount((await parts.count()));
    await expect(page.locator("#manualStatus")).toContainText("adicionada");
    await expect(parts.last()).toContainText(expected);
  }
  await expect(parts).toHaveCount(5);
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
