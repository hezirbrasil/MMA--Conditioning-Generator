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
  "starter-user-B20",
  "starter-user-B26",
  "starter-user-B13",
  "starter-user-B17",
  "starter-user-B7",
  "starter-user-B18",
  "starter-user-B25",
  "starter-user-B9",
  "starter-user-B11",
  "starter-user-B19",
  "starter-user-B24",
  "starter-user-B23",
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
  "starter-preset-circuit-9"
];

test("Banco B segue a ordem aprovada e tem IDs únicos", () => {
  assert.deepEqual(bankOrder.B, expectedB);
  assert.equal(new Set(bankOrder.B).size, bankOrder.B.length, "Banco B não pode duplicar IDs");
  assert.ok(!bankOrder.B.includes("starter-user-B21"), "O bloco B11 antigo deve estar fora da ordem");
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

test("B8 é Deltoide, B9 é Full Body, B10 é Costas + Bíceps e B4/B7 mantêm as posições", () => {
  const labels = readJsonConstant(/const renumberedBLabels=(\{[^\n]*\});/, "renumberedBLabels");
  assert.equal(labels["starter-user-B25"], "B8");
  assert.equal(labels["starter-user-B9"], "B9");
  assert.equal(labels["starter-user-B11"], "B10");
  assert.equal(labels["starter-user-B13"], "B4");
  assert.equal(labels["starter-user-B18"], "B7");
});

test("B13 coloca Joelhada Alternada antes da Prancha T, que fecha o bloco", () => {
  const start = html.indexOf("const userFourExerciseBlocks=[");
  const end = html.indexOf("userFourExerciseBlocks.forEach", start);
  const line = html.slice(start, end).split("\n").find(value => value.includes('id:"starter-user-B23"'));
  assert.ok(line, "Bloco B13 não encontrado");
  const bulgaroE = line.indexOf('name:"Búlgaro E"');
  const bulgaroD = line.indexOf('name:"Búlgaro D"');
  const knee = line.indexOf('name:"Joelhada no Step Alternada"');
  const plank = line.indexOf('name:"Prancha T"');
  assert.ok(bulgaroE >= 0 && bulgaroD > bulgaroE && knee > bulgaroD && plank > knee,
    "Sequência esperada: Búlgaro E, Búlgaro D, Joelhada Alternada, Prancha T");
  assert.ok(line.indexOf('name:"Prancha T"', plank + 1) < 0, "Prancha T deve aparecer uma vez");
});

test("O C12 Full Body mantém seus três exercícios definidos", () => {
  const start = html.indexOf("const c12Entry={");
  const end = html.indexOf("const c12Index=", start);
  const block = html.slice(start, end);
  assert.ok(block.includes('name:"Agachamento Sumô"'));
  assert.ok(block.includes('name:"Supino com Halteres"'));
  assert.ok(block.includes('name:"Remada Aberta"'));
});
