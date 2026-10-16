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

test("circuito usa timer total em minutos e segundos, sem tempo por item", async ({ page }) => {
  await page.goto("/");
  await page.locator("#manualPartType").selectOption("circuit");
  await page.locator("#manualAddPart").click();
  const circuit = page.locator("#manualParts .builder-part").first();
  await expect(circuit.locator('[data-manual-prop="durationMinutes"]')).toBeVisible();
  await expect(circuit.locator('[data-manual-prop="durationExtraSeconds"]')).toBeVisible();
  await expect(circuit.getByText("Tempo por item (segundos)", { exact: true })).toHaveCount(0);
  await expect(circuit.getByText("Descanso após cada item (segundos)", { exact: true })).toHaveCount(0);
  await circuit.locator('[data-manual-prop="durationMinutes"]').fill("2");
  await circuit.locator('[data-manual-prop="durationExtraSeconds"]').fill("30");
  await expect(circuit.locator(".builder-part-head")).toContainText("02:30");
});

test("exercício individual tem editor próprio, diferente do circuito", async ({ page }) => {
  await page.goto("/");
  await page.locator("#manualPartType").selectOption("individual");
  await page.locator("#manualAddPart").click();
  const individual = page.locator("#manualParts .builder-part").first();
  await expect(individual.locator('[data-manual-select]')).toBeVisible();
  await expect(individual.locator('[data-manual-batch-select]')).toHaveCount(0);
  await expect(individual.getByText("Tempo por item (segundos)", { exact: true })).toBeVisible();
  await page.locator("#manualPartType").selectOption("circuit");
  await page.locator("#manualAddPart").click();
  const circuit = page.locator("#manualParts .builder-part").nth(1);
  await expect(circuit.locator('[data-manual-prop="durationMinutes"]')).toBeVisible();
  await expect(circuit.locator('[data-manual-prop="durationExtraSeconds"]')).toBeVisible();
  await expect(circuit.locator('[data-manual-batch-select]')).toHaveCount(3);
  await expect(circuit.getByText("Tempo por item (segundos)", { exact: true })).toHaveCount(0);
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
