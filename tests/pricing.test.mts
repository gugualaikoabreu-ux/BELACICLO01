import assert from "node:assert/strict";
import test from "node:test";
import { effectiveUnitPrice } from "../lib/pricing.ts";

test("server chooses the stored promotional price only when it is valid", () => {
  assert.equal(effectiveUnitPrice(18_800, 15_000), 15_000);
  assert.equal(effectiveUnitPrice(18_800, null), 18_800);
  assert.equal(effectiveUnitPrice(18_800, 18_800), 18_800);
  assert.equal(effectiveUnitPrice(18_800, 20_000), 18_800);
});

test("server rejects an invalid stored regular price", () => {
  assert.throws(() => effectiveUnitPrice(0, null));
});
