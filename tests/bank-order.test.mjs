import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

function readJsonConstant(regex, label) {
  const match = html.match(regex);
  assert.ok(match, "Não encontrei " + label + " no index.html");
  return JSON.parse(match[1]);
}

const bankOrder = readJsonConstant(
  /const BANK_DISPLAY_ORDER = Object\.freeze\((\{[\s\S]*?\})\);/,
  "BANK_DISPLAY_ORDER"
);

const expectedB = [
  "starter-user-B16",
  "starter-user-B13",
  "starter-user-B20",
  "starter-user-B24",
  "starter-user-B26",
  "starter-user-B17",
  "starter-user-B7",
  "starter-user-B9",
  "starter-user-B11",
  "starter-user-B18",
  "starter-user-B19",
  "starter-bulgaro-joelhada-step",
  "starter-workout-bloco-1-four"
];

const expectedC = [
  "starter-user-C12",
  "starter-preset-circuit-3",
  "starter-preset-circuit-8",
  "starter-preset-circuit-10",
  "starter-preset-circuit-4",
  "starter-preset-circuit-1",
  "starter-preset-circuit-11",
  "starter-preset-circuit-5",
  "starter-preset-circuit-12",
  "starter-preset-circuit-2",
  "starter-preset-circuit-7",
  "starter-preset-circuit-9",
  "starter-user-C13-fullbody"
];

test("Banco B segue a ordem revisada, sem B8 antigo e sem lacunas", () => {
  assert.deepEqual(bankOrder.B, expectedB);
  assert.equal(new Set(bankOrder.B).size, bankOrder.B.length, "Banco B não pode duplicar IDs");
  assert.ok(!bankOrder.B.includes("starter-user-B21"), "O bloco de condicionamento antigo deve estar fora da ordem");
  assert.ok(!bankOrder.B.includes("starter-user-B25"), "B8 Deltoide deve estar removido");
  assert.ok(!bankOrder.B.includes("starter-user-B23"), "B12 deve estar removido");
  const removedIds = readJsonConstant(/const removedUserBlockIds=new Set\((\[[^\n]*\])\);/, "removedUserBlockIds");
  assert.ok(removedIds.includes("starter-user-B25"), "A exclusão de B8 deve persistir após recarregar");
  assert.ok(removedIds.includes("starter-user-B23"), "A exclusão de B12 deve persistir após recarregar");
  const labels = readJsonConstant(/const renumberedBLabels=(\{[^\n]*\});/, "renumberedBLabels");
  assert.deepEqual(Object.values(labels), Array.from({length:11}, (_,i) => "B" + (i+1)));
  assert.equal(labels["starter-user-B9"], "B8");
  assert.equal(labels["starter-user-B11"], "B9");
  assert.equal(labels["starter-user-B18"], "B10");
  assert.equal(labels["starter-user-B19"], "B11");
  assert.ok(!Object.hasOwn(labels, "starter-user-B23"), "O B12 excluído não deve receber rótulo");
  const start = html.indexOf("const userFourExerciseBlocks=[");
  const end = html.indexOf("userFourExerciseBlocks.forEach", start);
  assert.ok(!html.slice(start, end).includes('id:"starter-user-B25"'), "Bloco B8 não deve ser recriado");
  assert.ok(!html.slice(start, end).includes('id:"starter-user-B23"'), "B12 não deve ser recriado");
  const b7 = html.slice(start, end).split(String.fromCharCode(10)).find(line => line.includes('id:"starter-user-B7"'));
  assert.ok(b7 && b7.includes('name:"Joelhada no Step Alternada"') && !b7.includes('name:"Sprint"'), "B7 deve terminar com Joelhada no Step Alternada");
});

test("B9 visível corresponde exatamente aos quatro exercícios confirmados pelo usuário", () => {
  const visibleB9Id = bankOrder.B[8];
  assert.equal(visibleB9Id, "starter-user-B11", "B9 visível deve apontar para o bloco estável correto");
  const start = html.indexOf("const userFourExerciseBlocks=[");
  const end = html.indexOf("userFourExerciseBlocks.forEach", start);
  const definitions = html.slice(start, end);
  const b9 = definitions.split(String.fromCharCode(10)).find(line => line.includes('id:"starter-user-B11"'));
  assert.ok(b9, "Definição do B9 visível não encontrada");
  for (const exercise of ["Remada Aberta", "Pulldown", "Bíceps com Halter", "Agachamento Sumô"]) {
    assert.ok(b9.includes('name:"' + exercise + '"'), "B9 deve conter: " + exercise);
  }
});

test("Banco C segue a sequência agrupada e tem IDs únicos", () => {
  assert.deepEqual(bankOrder.C, expectedC);
  assert.equal(new Set(bankOrder.C).size, bankOrder.C.length, "Banco C não pode duplicar IDs");
});

test("A renderização usa a configuração central e numera os cartões sem lacunas", () => {
  assert.match(html, /const configuredIds=BANK_DISPLAY_ORDER\[prefix\]\|\|\[\]/);
  assert.match(html, /return ordered\.map\(\(x,index\)=>\(\{\.\.\.x\.entry,displayName:prefix\+\(index\+1\),displayNumber:index\+1\}\)\);/);
});

test("O antigo bloco de condicionamento B11 é removido da biblioteca e das definições", () => {
  const removedIds = readJsonConstant(
    /const removedUserBlockIds=new Set\((\[[^\n]*\])\);/,
    "removedUserBlockIds"
  );
  assert.ok(removedIds.includes("starter-user-B21"));
  const start = html.indexOf("const userFourExerciseBlocks=[");
  const end = html.indexOf("userFourExerciseBlocks.forEach", start);
  assert.ok(start >= 0 && end > start, "Definições dos blocos B não encontradas");
  const definitions = html.slice(start, end);
  assert.ok(!definitions.includes('id:"starter-user-B21"'), "B11 antigo não deve ser recriado");
});

test("A renumeração após excluir B8 mantém os grupos existentes ligados aos blocos corretos", () => {
  const labels = readJsonConstant(/const renumberedBLabels=(\{[^\n]*\});/, "renumberedBLabels");
  assert.equal(labels["starter-user-B9"], "B8");
  assert.equal(labels["starter-user-B11"], "B9");
  assert.equal(labels["starter-user-B18"], "B10");
  assert.equal(labels["starter-user-B24"], "B4");
  assert.equal(labels["starter-user-B7"], "B7");
  assert.equal(labels["starter-user-B19"], "B11");
  assert.ok(!Object.hasOwn(labels, "starter-user-B23"));
});

test("B12 é removido e o quarto exercício do B7 é atualizado", () => {
  const start = html.indexOf("const userFourExerciseBlocks=[");
  const end = html.indexOf("userFourExerciseBlocks.forEach", start);
  const definitions = html.slice(start, end);
  const b7 = definitions.split(String.fromCharCode(10)).find(line => line.includes('id:"starter-user-B7"'));
  assert.ok(b7 && b7.includes('name:"Joelhada no Step Alternada"') && !b7.includes('name:"Sprint"'));
  assert.ok(!definitions.includes('id:"starter-user-B23"'));
  const removedIds = readJsonConstant(/const removedUserBlockIds=new Set\((\[[^\n]*\])\);/, "removedUserBlockIds");
  assert.ok(removedIds.includes("starter-user-B23"));
});

test("Os cartões mostram número e grupamento muscular juntos", () => {
  const start = html.indexOf("const BANK_GROUP_LABELS = Object.freeze(");
  const open = html.indexOf("(", start) + 1;
  const end = html.indexOf(");", open);
  assert.ok(start >= 0 && open > 0 && end > open, "Mapa de grupamentos não encontrado");
  const groups = JSON.parse(html.slice(open, end));
  assert.equal(groups["starter-user-C12"], "Full Body");
  assert.equal(groups["starter-user-C13-fullbody"], "Full Body", "C13 novo deve ser Full Body");
  assert.equal(groups["starter-preset-circuit-3"], "Inferior");
  assert.equal(groups["starter-preset-circuit-4"], "Full Body", "C5 deve ser Full Body");
  assert.equal(groups["starter-preset-circuit-1"], "Full Body", "Circuito Remada Aberta + Stiff + Abdominal Infra deve ser Full Body");
  assert.equal(groups["starter-preset-circuit-5"], "Peitoral + Tríceps");
  assert.equal(groups["starter-preset-circuit-12"], "Costas + Bíceps");
  assert.equal(groups["starter-preset-circuit-7"], "Deltoide");
  assert.equal(groups["starter-bulgaro-joelhada-step"], "Inferior", "Inferior + Condicionamento deve ser unificado em Inferior");
  assert.ok(!html.includes('"Inferior Combinado"'), "Não deve haver filtro separado de Inferior Combinado");
  assert.ok(!html.includes('"Inferior + Condicionamento"'), "Não deve haver filtro separado de Inferior + Condicionamento");
  assert.equal(groups["starter-user-B7"], "Inferior + Core", "B7 deve ser Inferior + Core");
  assert.equal(groups["starter-user-B9"], "Full Body", "Este bloco passa a ser B8 após excluir o antigo B8");
  assert.equal(groups["starter-user-B11"], "Core", "Este bloco passa a ser B9 após excluir o antigo B8");
  assert.equal(groups["starter-user-B18"], "Inferior + Core", "Condicionamento + Core deve ser classificado como Inferior + Core");
  assert.equal(groups["starter-user-B19"], "Core", "Core + Condicionamento deve ser classificado apenas como Core");
  assert.ok(!html.includes('"Condicionamento + Core"'), "Não deve haver filtro separado de Condicionamento + Core");
  assert.ok(!html.includes('"Core + Condicionamento"'), "Não deve haver filtro separado de Core + Condicionamento");
  assert.ok(!Object.hasOwn(groups, "starter-user-B25"), "O mapa não deve reter a classificação do B8 excluído");
  assert.ok(html.includes('const title=entry.displayName+" — "+group;'));
});

test("A biblioteca tem filtro por grupamento e reage à mudança de seleção", () => {
  assert.ok(html.includes('id="manualVisualLibraryGroupFilter"'));
  assert.ok(html.includes("Filtrar por grupamento muscular"));
  assert.ok(html.includes('const visibleEntries=selectedGroup?entries.filter(entry=>manualBankGroup(entry)===selectedGroup):entries;'));
  assert.ok(html.includes('if(event.target&&event.target.id==="manualVisualLibraryGroupFilter")manualRenderVisualLibrary();'));
});

test("O C12 Full Body mantém seus três exercícios definidos", () => {
  const start = html.indexOf("const c12Entry={");
  const end = html.indexOf("const c12Index=", start);
  const block = html.slice(start, end);
  assert.ok(block.includes('name:"Agachamento Sumô"'));
  assert.ok(block.includes('name:"Supino com Halteres"'));
  assert.ok(block.includes('name:"Remada Aberta"'));
});

test("O C13 Full Body é mantido e contém os três exercícios solicitados", () => {
  const start = html.indexOf("const c13Entry={");
  const end = html.indexOf("const c13Index=", start);
  const block = html.slice(start, end);
  assert.ok(start >= 0 && end > start, "Definição do C13 não encontrada");
  assert.ok(block.includes('name:"Terra + Desenvolvimento"'));
  assert.ok(block.includes('name:"Agachamento + Remada Alta"'));
  assert.ok(block.includes('name:"Abdominal Bicicleta"'));
  assert.ok(html.includes('return id==="STARTER-USER-C13-FULLBODY"||!isC13;'),
    "A limpeza automática não deve excluir o C13 personalizado");
});
