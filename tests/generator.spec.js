const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("a página inicial carrega com as opções de treino", async ({ page }) => {
  await expect(page).toHaveTitle(/MMA Conditioning/);
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#type option")).toHaveText(["Full Body", "Leg Blast"]);
  await expect(page.locator("#generate")).toBeVisible();
});

for (const workoutType of [
  { label: "Full Body", value: "fullbody" },
  { label: "Leg Blast", value: "legblast" }
]) {
  test(`gera ${workoutType.label} com quatro blocos`, async ({ page }) => {
    await page.locator("#type").selectOption(workoutType.value);
    await page.locator("#generate").click();

    await expect(page.locator("#result")).toBeVisible();
    await expect(page.locator("#resultName")).toHaveText(workoutType.label.toUpperCase());
    await expect(page.locator(".block")).toHaveCount(4);
    await expect(page.locator(".blockhead")).toHaveText([
      /BLOCO 1 — FUNCIONAL/,
      /BLOCO 2 — LUTA/,
      /BLOCO 3 — FUNCIONAL/,
      /BLOCO 4 — LUTA/
    ]);

    const blockCounts = await page.locator(".block").evaluateAll(blocks =>
      blocks.map(block => block.querySelectorAll(".exercise").length)
    );
    expect(blockCounts).toEqual([12, 12, 8, 8]);
    await expect(page.locator(".exercise")).toHaveCount(40);
  });
}

test("não repete exercícios funcionais na mesma sessão", async ({ page }) => {
  await page.locator("#generate").click();

  const names = await page.locator(".block").nth(0).locator(".ename")
    .allTextContents();
  const secondBlockNames = await page.locator(".block").nth(2).locator(".ename")
    .allTextContents();
  const functionalNames = [...names, ...secondBlockNames];

  expect(new Set(functionalNames).size).toBe(functionalNames.length);
});

test("o banco contém a sequência de golpes solicitada", async ({ page }) => {
  const builtInSequence = await page.evaluate(() =>
    typeof fight !== "undefined" &&
    fight.includes("Direto + Uppercut T + Cruzado T")
  );
  expect(builtInSequence).toBe(true);
});

test("permite criar uma sequência e mantê-la após recarregar", async ({ page }) => {
  await page.locator("#techniqueSelect").selectOption("Jab");
  await page.locator("#addTechnique").click();
  await page.locator("#techniqueSelect").selectOption("Chute alto T");
  await page.locator("#addTechnique").click();
  await page.locator("#techniqueSelect").selectOption("Esquiva");
  await page.locator("#addTechnique").click();

  await expect(page.locator("#sequencePreview")).toContainText("Jab");
  await page.locator("#saveSequence").click();
  await expect(page.locator("#sequenceStatus")).toContainText("Sequência salva!");
  await expect(page.locator("#customFightBank")).toContainText(
    "Jab + Chute alto T + Esquiva"
  );

  await page.reload();
  await expect(page.locator("#customFightBank")).toContainText(
    "Jab + Chute alto T + Esquiva"
  );
});

test("Modo Play avança, volta e fecha", async ({ page }) => {
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

test("salva um treino e o recupera depois de recarregar", async ({ page }) => {
  await page.locator("#generate").click();
  await page.locator("#saveWorkoutButton").click();
  await page.locator("#savedWorkoutName").fill("Teste automatizado");
  await page.locator("#confirmSaveItem").click();

  await expect(page.locator("#savedItemsList")).toContainText("Teste automatizado");
  await page.reload();
  await page.locator("#generate").click();
  await page.locator("#openSavedButton").click();
  await expect(page.locator("#savedItemsList")).toContainText("Teste automatizado");

  await page.locator('[data-saved-action="load"]').click();
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator(".exercise")).toHaveCount(40);
});

test("dados personalizados inválidos no armazenamento não impedem o carregamento", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("mc-custom-fight", "{json inválido");
    localStorage.setItem("mc-custom-exercises", "{json inválido");
  });
  await page.reload();

  await expect(page.locator("#generate")).toBeVisible();
  await page.locator("#generate").click();
  await expect(page.locator("#result")).toBeVisible();
});

test("a interface não cria rolagem horizontal no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#generate").click();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(page.locator(".block").first()).toBeVisible();
});

test("monta um circuito manual e repete os itens pelo número de voltas", async ({ page }) => {
  await page.locator("#manualWorkoutName").fill("Circuito de teste");
  await page.locator("#manualPartType").selectOption("circuit");
  await page.locator("#manualAddPart").click();
  await page.locator('[data-manual-select="0"]').selectOption({ label: "Supino" });
  await page.locator('[data-manual-action="add-item"][data-p="0"]').click();
  await page.locator('[data-manual-prop="rounds"][data-p="0"]').selectOption("3");
  await page.locator('[data-manual-prop="rest"][data-p="0"]').selectOption("0");

  await expect(page.locator("#manualParts")).toContainText("Supino");
  await expect(page.locator("#manualParts")).toContainText("3 volta");
  await page.locator("#manualPlay").click();
  await expect(page.locator("#playOverlay")).toBeVisible();
  await expect(page.locator("#playCount")).toHaveText("ITEM 1 DE 3");
  await page.locator("#playNext").click();
  await expect(page.locator("#playType")).toContainText("Volta 2/3");
});

test("adiciona os dois lados de exercício unilateral no montador manual", async ({ page }) => {
  await page.locator("#manualAddPart").click();
  await page.locator('[data-manual-select="0"]').selectOption({ label: "Remada unilateral (E/D)" });
  await page.locator('[data-manual-action="add-item"][data-p="0"]').click();

  const items = await page.locator("#manualParts .builder-item span").allTextContents();
  expect(items.some(name => name.includes("Remada unilateral (E/D)"))).toBe(true);
});

test("salva e carrega uma parte reutilizável no montador manual", async ({ page }) => {
  await page.locator("#manualAddPart").click();
  await page.locator('[data-manual-select="0"]').selectOption({ label: "Supino" });
  await page.locator('[data-manual-action="add-item"][data-p="0"]').click();
  await page.locator('[data-manual-action="save-part"][data-p="0"]').click();
  await page.locator("#manualLibraryName").fill("Circuito reutilizável");
  await page.locator("#manualConfirmSave").click();

  await expect(page.locator("#manualLibraryList")).toContainText("Circuito reutilizável");
  await page.locator("#manualParts").locator('[data-manual-action="delete-part"]').click();
  await page.locator("#manualLibraryList").locator('[data-library-action="insert"]').click();
  await expect(page.locator("#manualParts")).toContainText("Supino");
});


test("adiciona um exercício do banco como avulso, sem criar circuito", async ({ page }) => {
  const button = page.locator('#bankList button[data-bank-manual-name="Supino"][data-bank-manual-mode="individual"]');
  await button.click();

  await expect(page.locator("#manualParts .builder-part")).toHaveCount(1);
  await expect(page.locator("#manualParts .builder-part")).toContainText("Exercícios individuais");
  await expect(page.locator("#manualParts .builder-item span")).toHaveCount(1);
  await expect(page.locator("#manualParts")).toContainText("Supino");
  await expect(page.locator("#manualParts .builder-part")).not.toContainText("Circuito funcional");
});

test("adiciona um exercício do banco ao circuito existente", async ({ page }) => {
  await page.locator("#manualPartType").selectOption("circuit");
  await page.locator("#manualAddPart").click();
  await page.locator('#manualParts [data-manual-select="0"]').selectOption({ label: "Crucifixo" });
  await page.locator('#manualParts [data-manual-action="add-item"][data-p="0"]').click();

  await page.locator('#bankList button[data-bank-manual-name="Supino"][data-bank-manual-mode="circuit"]').click();

  await expect(page.locator("#manualParts .builder-part")).toHaveCount(1);
  await expect(page.locator("#manualParts .builder-item span")).toHaveCount(2);
  await expect(page.locator("#manualParts")).toContainText("Crucifixo");
  await expect(page.locator("#manualParts")).toContainText("Supino");
});

test("adiciona três exercícios ao mesmo circuito de uma só vez", async ({ page }) => {
  await page.locator("#manualPartType").selectOption("circuit");
  await page.locator("#manualAddPart").click();
  const selectors = page.locator('[data-manual-batch-select="0"]');
  await selectors.nth(0).selectOption({ label: "Supino" });
  await selectors.nth(1).selectOption({ label: "Crucifixo" });
  await selectors.nth(2).selectOption({ label: "Agachamento Livre" });
  await page.locator('[data-manual-action="add-batch"][data-p="0"]').click();

  await expect(page.locator("#manualParts .builder-part")).toHaveCount(1);
  await expect(page.locator("#manualParts .builder-item span")).toHaveCount(3);
  await expect(page.locator("#manualParts")).toContainText("Supino");
  await expect(page.locator("#manualParts")).toContainText("Crucifixo");
  await expect(page.locator("#manualParts")).toContainText("Agachamento Livre");
});
