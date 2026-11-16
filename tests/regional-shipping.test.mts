import assert from "node:assert/strict";
import test from "node:test";
import { buildConfiguredShippingOptions, selectServerShippingOption } from "../lib/shipping/options.ts";
import { classifyRegionalDestination, CURITIBA_METROPOLITAN_MUNICIPALITIES } from "../lib/shipping/regional.ts";
import { calculateCheckoutTotal } from "../lib/checkout/totals.ts";

const settings = {
  regionalShippingEnabled: true,
  curitibaMetroShippingCents: 1_000,
  interiorParanaShippingCents: 2_000,
  otherStatesShippingCents: 3_000,
  fixedShippingEnabled: false,
  fixedShippingCents: null,
  freeShippingEnabled: false,
  freeShippingThresholdCents: null,
  estimatedMinDays: null,
  estimatedMaxDays: null,
};

test("usa os 29 municípios oficiais da Região Metropolitana de Curitiba", () => {
  assert.equal(CURITIBA_METROPOLITAN_MUNICIPALITIES.length, 29);
  assert.equal(new Set(CURITIBA_METROPOLITAN_MUNICIPALITIES).size, 29);
  for (const city of CURITIBA_METROPOLITAN_MUNICIPALITIES) {
    assert.equal(classifyRegionalDestination(city, "PR"), "CURITIBA_METRO", city);
  }
});

test("aplica as tarifas pedidas para os nove municípios de verificação", () => {
  const cases = [
    ["Curitiba", "PR", 1_000],
    ["São José dos Pinhais", "PR", 1_000],
    ["Colombo", "PR", 1_000],
    ["Pinhais", "PR", 1_000],
    ["Araucária", "PR", 1_000],
    ["Londrina", "PR", 2_000],
    ["Maringá", "PR", 2_000],
    ["São Paulo", "SP", 3_000],
    ["Florianópolis", "SC", 3_000],
  ] as const;

  for (const [city, state, expectedCents] of cases) {
    const [option] = buildConfiguredShippingOptions(settings, { city, state }, 5_000);
    assert.equal(option?.method, "regional", city);
    assert.equal(option?.shippingCents, expectedCents, city);
  }
});

test("normaliza acentos e só classifica a RMC quando a UF é PR", () => {
  assert.equal(classifyRegionalDestination("Sao Jose dos Pinhais", "pr"), "CURITIBA_METRO");
  assert.equal(classifyRegionalDestination("Curitiba", "SC"), "OTHER_STATES");
  assert.equal(classifyRegionalDestination("Londrina", "PR"), "PARANA_INTERIOR");
  assert.equal(classifyRegionalDestination("", "PR"), null);
});

test("não exibe frete fixo ou grátis desligados e recalcula o limite com o subtotal novo", () => {
  assert.equal(buildConfiguredShippingOptions(settings, { city: "Curitiba", state: "PR" }, 19_999).length, 1);
  const configured = {
    ...settings,
    freeShippingEnabled: true,
    freeShippingThresholdCents: 20_000,
    fixedShippingEnabled: true,
    fixedShippingCents: 1_500,
  };
  const below = buildConfiguredShippingOptions(configured, { city: "Curitiba", state: "PR" }, 19_999);
  const atThreshold = buildConfiguredShippingOptions(configured, { city: "Curitiba", state: "PR" }, 20_000);
  assert.equal(below.some((option) => option.method === "free_threshold"), false);
  assert.equal(atThreshold.find((option) => option.method === "free_threshold")?.shippingCents, 0);
  assert.equal(atThreshold.find((option) => option.method === "fixed_store_rate")?.shippingCents, 1_500);
});

test("backend seleciona apenas uma opção retornada e rejeita valor manipulado", () => {
  const options = buildConfiguredShippingOptions(settings, { city: "Curitiba", state: "PR" }, 5_000);
  assert.equal(selectServerShippingOption(options, "BELACICLO_RMC", 1_000).shippingCents, 1_000);
  assert.throws(() => selectServerShippingOption(options, "BELACICLO_RMC", 1), /valor do frete foi atualizado/i);
  assert.throws(() => selectServerShippingOption(options, "BELACICLO_OUTROS_ESTADOS", 3_000), /tarifa de entrega não está disponível/i);
});

test("o total combina subtotal, desconto e frete em centavos", () => {
  assert.equal(calculateCheckoutTotal(5_000, 0, 1_000), 6_000);
  assert.equal(calculateCheckoutTotal(5_000, 500, 1_000), 5_500);
  assert.equal(calculateCheckoutTotal(5_000, 5_001, 1_000), null);
});
