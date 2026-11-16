import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVariantKey } from "../lib/product-variant-key.ts";

test("variant matching ignores surrounding spaces and letter case", () => {
  assert.equal(normalizeVariantKey(" P ", "Azul"), normalizeVariantKey("p", " azul "));
});

test("a missing color matches a blank color", () => {
  assert.equal(normalizeVariantKey("M"), normalizeVariantKey(" M ", "  "));
});
