const { test, expect } = require("@playwright/test");

async function readWorkout(page) {
  return page.evaluate(() => manualParts.map((part) => ({
    type: part.type,
    title: part.title || "",
    seconds: Number(part.seconds ?? 0),
    rest: Number(part.rest ?? 0),
    durationMinutes: Number(part.durationMinutes ?? 0),
    durationExtraSeconds: Number(part.durationExtraSeconds ?? 0),
    items: (part.items || []).map((item) => String(item.name || "").trim())
  })));
}

function assertWorkoutIntegrity(parts, option) {
  expect(parts.length, "o gerador deve produzir etapas").toBeGreaterThan(0);
  expect(parts.some((part) => ["circuit", "individual", "fight", "fightCircuit"].includes(part.type)),
    "o treino deve conter blocos de trabalho").toBe(true);

  for (const part of parts) {
    if (part.type === "circuit") {
      expect(part.items, part.title).toHaveLength(3);
      expect(part.durationMinutes * 60 + part.durationExtraSeconds, part.title).toBe(210);
    } else if (part.type === "individual") {
      expect(part.items, part.title).toHaveLength(4);
      expect(part.seconds, part.title).toBe(50);
      expect(part.rest, part.title).toBe(10);
    } else if (part.type === "fight" || part.type === "fightCircuit") {
      expect(part.items, part.title).toHaveLength(4);
      expect(part.seconds, part.title).toBe(240);
    } else if (part.type === "transition") {
      expect(part.seconds, part.title).toBe(90);
    } else if (part.type === "activePause") {
      expect(part.seconds, part.title).toBe(30);
    }

    if (["circuit", "individual", "fight", "fightCircuit"].includes(part.type)) {
      expect(part.items.every(Boolean), part.title + " não pode conter nomes vazios").toBe(true);
      expect(new Set(part.items.map((name) => name.toLocaleLowerCase("pt-BR"))).size,
        part.title + " não pode repetir um exercício dentro do bloco").toBe(part.items.length);
    }
  }

  const circuits = parts.filter((part) => part.type === "circuit");
  expect(circuits.length, "a estrutura física 3:30 deve conter os dois circuitos iniciais e um final")
    .toBe([1, 3].includes(option) ? 3 : 0);

  const firstWorkPart = parts.find((part) =>
    ["circuit", "individual", "fight", "fightCircuit"].includes(part.type));
  const expectedFirstPart = ({ 1: "circuit", 2: "fight", 3: "fight", 4: "individual" })[option];
  expect(firstWorkPart.type, "o modelo deve começar pela modalidade correta").toBe(expectedFirstPart);

  // Nenhum exercício WORKOUT deve aparecer duas vezes na mesma aula.
  // Os pares E/D têm nomes diferentes e permanecem representados como lados distintos.
  const workoutNames = parts
    .filter((part) => ["circuit", "individual"].includes(part.type))
    .flatMap((part) => part.items)
    .map((name) => name.toLocaleLowerCase("pt-BR"));
  expect(new Set(workoutNames).size, "não deve haver exercícios WORKOUT repetidos na aula")
    .toBe(workoutNames.length);

  // Quando uma variação unilateral é representada por E ou D, os dois lados devem
  // aparecer juntos no mesmo bloco, de acordo com a regra do banco de exercícios.
  for (const part of parts.filter((item) => ["circuit", "individual"].includes(item.type))) {
    const sides = new Map();
    for (const name of part.items) {
      const match = name.match(/^(.*) ([ED])$/);
      if (!match) continue;
      const base = match[1].toLocaleLowerCase("pt-BR");
      if (!sides.has(base)) sides.set(base, new Set());
      sides.get(base).add(match[2]);
    }
    for (const [base, presentSides] of sides) {
      expect([...presentSides].sort(), part.title + ": " + base + " deve conter os lados E e D")
        .toEqual(["D", "E"]);
    }
  }
}

test("o aplicativo abre sem exceções JavaScript", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page).toHaveTitle(/MMA Conditioning/i);
  await expect(page.locator("#loadOption1")).toBeVisible();
  await expect(page.locator("#loadOption2")).toBeVisible();
  await expect(page.locator("#loadOption3")).toBeVisible();
  await expect(page.locator("#loadOption4")).toBeVisible();
  expect(pageErrors, "erros JavaScript durante a inicialização").toEqual([]);
});

for (const workoutType of ["fullbody", "legblast"]) {
  for (const option of [1, 2, 3, 4]) {
    test(`modelo ${option} gera estrutura íntegra em ${workoutType}`, async ({ page }) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.goto("/");
      await page.locator("#presetWorkoutType").selectOption(workoutType);
      await page.locator(`#loadOption${option}`).click();

      await expect.poll(async () => page.evaluate(() =>
        Array.isArray(manualParts) && manualParts.some((part) =>
          ["circuit", "individual", "fight", "fightCircuit"].includes(part.type))
      )).toBe(true);

      const parts = await readWorkout(page);
      assertWorkoutIntegrity(parts, option);
      expect(pageErrors, "exceções JavaScript ao gerar o treino").toEqual([]);
      await expect(page.locator("#manualParts .builder-part").first()).toBeVisible();
    });
  }
}

test("regenerar aula substitui blocos inteiros e mantém a estrutura", async ({ page }) => {
  await page.goto("/");
  await page.locator("#presetWorkoutType").selectOption("fullbody");
  await page.locator("#loadOption1").click();

  const before = await readWorkout(page);
  const beforeWork = before.filter((part) => ["circuit", "individual"].includes(part.type));
  expect(beforeWork.length).toBeGreaterThan(0);

  await page.locator("#regeneratePreset").click();
  await expect.poll(async () => page.evaluate(() =>
    document.querySelector("#manualStatus")?.textContent || ""
  )).not.toContain("Gerando treino");

  const after = await readWorkout(page);
  const afterWork = after.filter((part) => ["circuit", "individual"].includes(part.type));
  expect(afterWork.length).toBe(beforeWork.length);
  expect(afterWork.map((part) => part.type)).toEqual(beforeWork.map((part) => part.type));

  for (const part of afterWork) {
    expect(part.items.length, part.title).toBe(part.type === "circuit" ? 3 : 4);
  }

  const signature = (part) => part.type + ":" + part.items.join("|");
  const oldSignatures = beforeWork.map(signature);
  const newSignatures = afterWork.map(signature);
  expect(newSignatures.some((value, index) => value !== oldSignatures[index]),
    "a regeneração deve trocar pelo menos um bloco completo, não apenas redesenhar a interface").toBe(true);
});

test("Modo Play abre, permite avançar e pode ser fechado", async ({ page }) => {
  await page.goto("/");
  await page.locator("#loadOption1").click();
  await page.locator("#manualPlay").click();

  await expect(page.locator("#playOverlay")).toBeVisible();
  await expect(page.locator("#playTimerText")).toBeVisible();
  await expect(page.locator("#playPrev")).toBeVisible();
  await expect(page.locator("#playPause")).toBeVisible();
  await expect(page.locator("#playNext")).toBeVisible();

  await page.locator("#playNext").click();
  await expect(page.locator("#playGroup")).not.toBeEmpty();
  await page.locator("#closePlay").click();
  await expect(page.locator("#playOverlay")).toBeHidden();
});

test("layout móvel não cria rolagem horizontal na página principal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(dimensions.page, "o conteúdo não deve ultrapassar a largura do celular")
    .toBeLessThanOrEqual(dimensions.viewport + 1);
});
