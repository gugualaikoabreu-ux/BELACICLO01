import assert from "node:assert/strict";
import test from "node:test";
import { createStableOrderNumber } from "../lib/checkout/identifiers.ts";

test("checkout retry keeps the same order number for the same user and idempotency key", () => {
  const first = createStableOrderNumber("user-123", "checkout-attempt-1234567890");
  const retry = createStableOrderNumber("user-123", "checkout-attempt-1234567890");
  assert.equal(retry, first);
  assert.match(first, /^BC-[A-F0-9]{24}$/);
});

test("different users or checkout attempts receive different order numbers", () => {
  const original = createStableOrderNumber("user-123", "checkout-attempt-1234567890");
  assert.notEqual(createStableOrderNumber("user-456", "checkout-attempt-1234567890"), original);
  assert.notEqual(createStableOrderNumber("user-123", "checkout-attempt-0987654321"), original);
});
