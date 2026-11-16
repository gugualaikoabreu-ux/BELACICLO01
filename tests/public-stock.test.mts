import assert from "node:assert/strict";
import test from "node:test";
import { publicAvailableVariants } from "../lib/public-stock.ts";

test("public catalogue exposes availability but strips exact inventory counts", () => {
  const result = publicAvailableVariants([
    { id: "available", size: "M", color: "Azul", stock: 9, reserved: 4, active: true },
    { id: "reserved-out", size: "P", color: "Azul", stock: 2, reserved: 2, active: true },
    { id: "inactive", size: "G", color: "Azul", stock: 7, reserved: 0, active: false },
  ]);
  assert.deepEqual(result, [{ id: "available", size: "M", color: "Azul", available: true }]);
  assert.equal("stock" in result[0]!, false);
  assert.equal("reserved" in result[0]!, false);
});
