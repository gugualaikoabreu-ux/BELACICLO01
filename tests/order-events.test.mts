import assert from "node:assert/strict";
import test from "node:test";
import { recordOrderEvent } from "../lib/order-events.ts";

function fakeTransaction(columns: { actorId: boolean; actorEmail: boolean }) {
  const statements: string[] = [];
  const tx = {
    $queryRaw: async () => [columns],
    $executeRaw: async (parts: TemplateStringsArray) => {
      statements.push(parts.join("?"));
      return 1;
    },
  };
  return { tx, statements };
}

test("order event insert adapts to schemas with neither audit column", async () => {
  const { tx, statements } = fakeTransaction({ actorId: false, actorEmail: false });
  await recordOrderEvent(tx as never, { orderId: "order-1", status: "CANCELLED", note: "Cliente" });
  assert.equal(statements.length, 1);
  assert.match(statements[0], /"createdAt"/);
  assert.doesNotMatch(statements[0], /"actorId"|"actorEmail"/);
});

test("order event insert retains audit fields when the schema has both", async () => {
  const { tx, statements } = fakeTransaction({ actorId: true, actorEmail: true });
  await recordOrderEvent(tx as never, { orderId: "order-1", status: "PREPARING", actorId: "admin-1", actorEmail: "admin@example.test" });
  assert.match(statements[0], /"actorId"/);
  assert.match(statements[0], /"actorEmail"/);
});
