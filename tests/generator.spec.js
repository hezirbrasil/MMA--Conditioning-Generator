const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("a página inicial carrega com as opções de treino", async ({ page }) => {
  await expect(page).toHaveTitle(/Workout Round Timer/);
  await expect(page.locator("#type")).toBeVisible();
  await expect(page.locator("#type option")).toHaveText(["Full Body", "Leg Blast"]);
  await expect(page.locator("#generate")).toBeVisible();
});

test("audita as alterações de interface solicitadas", async ({ page }) => {
  const partType = page.locator("#manualPartType");
  await expect(partType.locator("option")).toHaveText([
    "Circuito funcional",
    "Exercício individual",
    "Sequências de luta individuais",
    "Descanso / transição"
  ]);
  await expect(partType).not.toContainText("Bloco de exercícios individuais");
  await expect(partType).not.toContainText("Circuito de luta");

  const categories = page.locator("#bankList details.bank-category");
  await expect(categories).not.toHaveCount(0);
  await expect(page.locator("#bankList details.bank-category[open]")).toHaveCount(0);

  await page.locator("#bankCategoryFilter").selectOption("peito");
  await expect(page.locator("#bankList details.bank-category[open]")).toHaveCount(1);
  await expect(page.locator("#bankList details.bank-category summary")).toContainText("PEITO");

  await page.locator("#manualPartType").selectOption("circuit");
  await page.locator("#manualAddPart").click();
  const groupedOptions = page.locator('#manualParts [data-manual-select="0"] optgroup');
  await expect(groupedOptions).toContainText(["PEITO", "COSTAS", "OMBROS", "BÍCEPS", "TRÍCEPS", "PERNAS", "POSTERIOR", "COMPOSTOS", "CORE E ABDOMINAIS", "CARDIO E FUNCIONAL"]);
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

test("circuito manual usa duração e repete os exercícios até o tempo acabar", async ({ page }) => {
  await page.locator("#manualWorkoutName").fill("Circuito por tempo");
  await page.locator("#manualPartType").selectOption("circuit");
  await page.locator("#manualAddPart").click();
  await page.locator('[data-manual-select="0"]').selectOption({ label: "Supino" });
  await page.locator('[data-manual-action="add-item"][data-p="0"]').click();
  await page.locator('[data-manual-prop="durationMinutes"][data-p="0"]').selectOption("3");
  await page.locator('[data-manual-prop="seconds"][data-p="0"]').selectOption("15");
  await page.locator('[data-manual-prop="rest"][data-p="0"]').selectOption("0");
  await expect(page.locator('[data-manual-prop="rounds"]')).toHaveCount(0);
  await expect(page.locator("#manualParts")).toContainText("3 min");
  await expect(page.locator("#manualParts")).toContainText("Supino");
  await page.locator("#manualPlay").click();
  await expect(page.locator("#playOverlay")).toBeVisible();
  await expect(page.locator("#playCount")).toHaveText("ITEM 1 DE 12");
  await expect(page.locator("#playType")).toContainText("circuito 03:00");
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
  await expect(page.locator("#manualParts .builder-part")).toContainText("Exercício individual");
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
  await expect(page.locator('[data-manual-action="add-batch"][data-p="0"]')).toHaveText("＋ Adicionar selecionados ao mesmo circuito");
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


test("audita botões do montador manual e suas ações", async ({ page }) => {
  await page.locator("#manualPartType").selectOption("circuit");
  await page.locator("#manualAddPart").click();
  await page.locator('[data-manual-batch-select="0"]').nth(0).selectOption({ label: "Supino" });
  await page.locator('[data-manual-batch-select="0"]').nth(1).selectOption({ label: "Crucifixo" });
  await page.locator('[data-manual-action="add-batch"][data-p="0"]').click();
  await expect(page.locator("#manualParts .builder-item")).toHaveCount(2);

  await page.locator('[data-manual-action="add-slot"][data-p="0"]').click();
  await expect(page.locator('[data-manual-batch-select="0"]')).toHaveCount(6);
  await page.locator('[data-manual-select="0"]').selectOption({ label: "Agachamento Livre" });
  await page.locator('[data-manual-action="add-item"][data-p="0"]').click();
  await expect(page.locator("#manualParts .builder-item")).toHaveCount(3);

  await page.locator("#manualPartType").selectOption("individual");
  await page.locator("#manualAddPart").click();
  await page.locator('[data-manual-action="up"][data-p="1"]').click();
  await expect(page.locator("#manualParts .builder-part").first()).toContainText("Exercício individual");
  await page.locator('[data-manual-action="down"][data-p="0"]').click();
  await expect(page.locator("#manualParts .builder-part").first()).toContainText("Circuito funcional");
  await page.locator('[data-manual-action="remove-item"][data-p="0"][data-i="0"]').click();
  await expect(page.locator("#manualParts .builder-item")).toHaveCount(2);

  await page.locator('[data-manual-action="save-part"][data-p="0"]').click();
  await page.locator("#manualLibraryName").fill("Parte de auditoria");
  await page.locator("#manualConfirmSave").click();
  await expect(page.locator("#manualLibraryList")).toContainText("Parte de auditoria");
  await page.locator("#manualCloseLibrary").click();

  await page.locator("#manualSaveWorkout").click();
  await page.locator("#manualLibraryName").fill("Treino de auditoria");
  await page.locator("#manualConfirmSave").click();
  await expect(page.locator("#manualLibraryList")).toContainText("Treino de auditoria");
  await page.locator("#manualShowLibrary").click();
  await expect(page.locator("#manualLibrary")).toBeVisible();
  await page.locator("#manualCloseLibrary").click();

  await page.locator("#manualPlay").click();
  await expect(page.locator("#playOverlay")).toBeVisible();
  await page.locator("#playNext").click();
  await page.locator("#playPrev").click();
  await page.locator("#closePlay").click();
  await expect(page.locator("#playOverlay")).toBeHidden();

  await page.locator('#manualLibraryList [data-library-action="insert"]').first().click();
  await expect(page.locator("#manualParts .builder-part")).toHaveCount(3);
  await page.locator('#manualLibraryList [data-library-action="load"]').first().click();
  await expect(page.locator("#manualParts .builder-part")).toHaveCount(2);
  await page.locator('#manualLibraryList [data-library-action="delete"]').first().click();
  await page.locator('[data-manual-action="delete-part"]').first().click();
  await expect(page.locator("#manualParts .builder-part")).toHaveCount(1);
});

test("audita botões do banco, do treino tradicional e dos favoritos", async ({ page }) => {
  await page.locator('#bankList button[data-bank-manual-name="Supino"][data-bank-manual-mode="individual"]').click();
  await expect(page.locator("#manualParts")).toContainText("Supino");
  await page.locator('#bankList button[data-bank-manual-name="Crucifixo"][data-bank-manual-mode="circuit"]').click();
  await expect(page.locator("#manualParts")).toContainText("Crucifixo");

  await page.locator("#generate").click();
  await page.locator('#bankList button[data-bank-name="Agachamento Livre"][data-bank-target="0"]').click();
  await expect(page.locator(".block").nth(0)).toContainText("Agachamento Livre");
  await page.locator('#bankList button[data-bank-name="Supino"][data-bank-target="2"]').click();
  await expect(page.locator(".block").nth(2)).toContainText("Supino");

  await page.locator("#again").click();
  await expect(page.locator(".block")).toHaveCount(4);
  await page.locator("#openPlay").click();
  await page.locator("#playNext").click();
  await page.locator("#playPrev").click();
  await page.locator("#closePlay").click();

  await page.locator("#saveWorkoutButton").click();
  await page.locator("#savedWorkoutName").fill("Botões auditados");
  await page.locator("#confirmSaveItem").click();
  await expect(page.locator("#savedItemsList")).toContainText("Botões auditados");
  await page.locator("#openSavedButton").click();
  await page.locator('#savedItemsList [data-saved-action="load"]').click();
  await expect(page.locator("#result")).toBeVisible();
  await page.locator("#openSavedButton").click();
  await page.locator('#savedItemsList [data-saved-action="delete"]').click();
  await expect(page.locator("#savedItemsList")).not.toContainText("Botões auditados");
  await page.locator("#closeSavedPanel").click();

  await page.evaluate(() => { window.__printCalled = false; window.print = () => { window.__printCalled = true; }; });
  await page.locator("#print").click();
  expect(await page.evaluate(() => window.__printCalled)).toBe(true);
  await page.locator("#copy").click();
});

test("audita botões de criar, desfazer, limpar, salvar e editar sequência de luta", async ({ page }) => {
  await page.locator("#techniqueSelect").selectOption("Jab");
  await page.locator("#addTechnique").click();
  await expect(page.locator("#sequencePreview")).toContainText("Jab");
  await page.locator("#undoTechnique").click();
  await expect(page.locator("#sequencePreview")).not.toContainText("Jab");

  for (const technique of ["Jab", "Chute alto T", "Esquiva"]) {
    await page.locator("#techniqueSelect").selectOption(technique);
    await page.locator("#addTechnique").click();
  }
  await page.locator("#saveSequence").click();
  await expect(page.locator("#customFightBank")).toContainText("Jab + Chute alto T + Esquiva");

  await page.locator('#customFightBank button[data-fight-target="1"]').click();
  await expect(page.locator(".block").nth(1)).toContainText("Jab + Chute alto T + Esquiva");
  await page.locator('.block').nth(1).getByRole("button", { name: "Editar golpe" }).first().click();
  await expect(page.locator("#fightEditPanel")).toBeVisible();
  await page.locator("#cancelFightEdit").click();
  await page.locator('.block').nth(1).getByRole("button", { name: "Editar golpe" }).first().click();
  const replacement = page.locator("#fightEditReplacement");
  const options = await replacement.locator("option").evaluateAll(os => os.map(o => o.value).filter(Boolean));
  if (options.length) {
    await replacement.selectOption(options[0]);
    await page.locator("#applyFightEdit").click();
  } else {
    await page.locator("#cancelFightEdit").click();
  }

  await page.locator('#customFightBank button[data-custom-fight-delete]').click();
  await expect(page.locator("#customFightBank")).not.toContainText("Jab + Chute alto T + Esquiva");
  await page.locator("#clearSequence").click();
  await expect(page.locator("#sequencePreview")).toBeEmpty();
});


test("audita mover, trocar e excluir exercício do treino gerado", async ({ page }) => {
  await page.locator("#generate").click();
  const block = page.locator(".block").nth(0);
  const firstBefore = await block.locator(".exercise").nth(0).locator(".ename").textContent();
  await block.locator(".exercise").nth(0).getByRole("button", { name: "Mover para baixo" }).click();
  const firstAfter = await page.locator(".block").nth(0).locator(".exercise").nth(0).locator(".ename").textContent();
  expect(firstAfter).not.toBe(firstBefore);

  await page.locator(".block").nth(0).locator(".exercise").nth(0).getByRole("button", { name: "↻ Trocar" }).click();
  const picker = page.locator(".replace-picker").first();
  await expect(picker).toBeVisible();
  const category = picker.locator("select").nth(0);
  const categoryValues = await category.locator("option").evaluateAll(os => os.map(o => o.value).filter(Boolean));
  expect(categoryValues.length).toBeGreaterThan(0);
  await category.selectOption(categoryValues[0]);
  const item = picker.locator("select").nth(1);
  const itemValues = await item.locator("option").evaluateAll(os => os.map(o => o.value).filter(Boolean));
  expect(itemValues.length).toBeGreaterThan(0);
  await item.selectOption(itemValues[0]);
  await picker.getByRole("button", { name: "Substituir" }).click();
  await expect(page.locator(".replace-picker")).toHaveCount(0);

  const countBeforeDelete = await page.locator(".block").nth(0).locator(".exercise").count();
  await page.locator(".block").nth(0).locator(".exercise").nth(0).getByRole("button", { name: "Excluir" }).click();
  await expect(page.locator(".block").nth(0).locator(".exercise")).toHaveCount(countBeforeDelete - 1);
});
