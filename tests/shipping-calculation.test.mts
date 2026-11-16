import test from "node:test";
import assert from "node:assert/strict";
import { combinePackageDimensions, parseBrazilianAmountToCents } from "../lib/shipping/calculation.ts";
import { storeShippingAmount } from "../lib/shipping/policy.ts";

test("combina peso e dimensões das unidades do pedido", () => {
  const parcel = combinePackageDimensions([
    { product: { weightGrams: 250, lengthCm: 25, widthCm: 20, heightCm: 5 }, quantity: 2 },
    { product: { weightGrams: 300, lengthCm: 30, widthCm: 24, heightCm: 8 }, quantity: 1 },
  ]);
  assert.deepEqual(parcel, { weightGrams: 800, lengthCm: 80, widthCm: 24, heightCm: 8 });
});

test("recusa cotações de embalagem sem dados reais ou com quantidade inválida", () => {
  assert.equal(combinePackageDimensions([{ product: { weightGrams: null, lengthCm: 20, widthCm: 15, heightCm: 5 }, quantity: 1 }]), null);
  assert.equal(combinePackageDimensions([{ product: { weightGrams: 100, lengthCm: 20, widthCm: 15, heightCm: 5 }, quantity: 0 }]), null);
});

test("converte valores dos Correios em reais para centavos", () => {
  assert.equal(parseBrazilianAmountToCents("11,64"), 1164);
  assert.equal(parseBrazilianAmountToCents("1.234,56"), 123456);
  assert.equal(parseBrazilianAmountToCents(9.53), 953);
  assert.equal(parseBrazilianAmountToCents(-1), null);
  assert.equal(parseBrazilianAmountToCents("valor inválido"), null);
});

test("applies store free-shipping threshold before the fixed-rate fallback", () => {
  assert.deepEqual(storeShippingAmount({ fixedShippingCents: 1290, freeShippingThresholdCents: 20_000 }, 19_999), {
    shippingCents: 1290, serviceName: "Entrega definida pela loja", source: "fixed_store_rate",
  });
  assert.deepEqual(storeShippingAmount({ fixedShippingCents: 1290, freeShippingThresholdCents: 20_000 }, 20_000), {
    shippingCents: 0, serviceName: "Frete grátis da loja", source: "free_threshold",
  });
  assert.equal(storeShippingAmount({ fixedShippingCents: null, freeShippingThresholdCents: null }, 500), null);
});
