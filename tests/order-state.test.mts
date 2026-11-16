import assert from "node:assert/strict";
import test from "node:test";
import { buildOrderEventNote, canTransitionOrderStatus, describeTrackingChanges } from "../lib/order-state.ts";

test("shipping starts only after payment approval", () => {
  assert.equal(canTransitionOrderStatus("RECEIVED", "PREPARING"), false);
  assert.equal(canTransitionOrderStatus("PAYMENT_APPROVED", "PREPARING"), true);
});

test("shipping and delivery follow their expected order", () => {
  assert.equal(canTransitionOrderStatus("PREPARING", "SHIPPED"), true);
  assert.equal(canTransitionOrderStatus("PREPARING", "DELIVERED"), false);
  assert.equal(canTransitionOrderStatus("SHIPPED", "DELIVERED"), true);
  assert.equal(canTransitionOrderStatus("DELIVERED", "SHIPPED"), false);
});

test("a cancelled order cannot return to fulfillment", () => {
  assert.equal(canTransitionOrderStatus("CANCELLED", "CANCELLED"), true);
  assert.equal(canTransitionOrderStatus("CANCELLED", "PREPARING"), false);
});

test("tracking changes produce an audit note and unchanged values do not", () => {
  const current = { trackingCode: "BR123", trackingUrl: null };
  const changes = describeTrackingChanges(current, { trackingCode: "BR456", trackingUrl: "https://rastreamento.example/BR456" });
  assert.deepEqual(changes, ["Código de rastreamento atualizado.", "Link de rastreamento atualizado."]);
  assert.equal(buildOrderEventNote(undefined, changes), "Código de rastreamento atualizado. Link de rastreamento atualizado.");
  assert.deepEqual(describeTrackingChanges(current, { trackingCode: "BR123" }), []);
});

test("admin notes remain recordable even when the order status is unchanged", () => {
  assert.equal(buildOrderEventNote("  Conferido com a cliente.  ", []), "Conferido com a cliente.");
  assert.equal(buildOrderEventNote(undefined, []), null);
});
