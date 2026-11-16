import assert from "node:assert/strict";
import test from "node:test";
import { confirmOrderPaymentManually, recordManualPaymentReviewStatus } from "../lib/order-payment.ts";

function paymentFixture(overrides: { paymentAmount?: number; provider?: string; paymentStatus?: string; expiresAt?: Date | null; reservations?: { id: string; variantId: string; quantity: number; expiresAt: Date; releasedAt: Date | null }[] } = {}) {
  const now = new Date("2026-11-07T18:00:00.000Z");
  const payment = { id: "payment-1", provider: overrides.provider ?? "MANUAL_PIX_STATIC", amount: overrides.paymentAmount ?? 2500, paymentStatus: overrides.paymentStatus ?? "PENDING", expiresAt: overrides.expiresAt === undefined ? new Date(now.getTime() + 60_000) : overrides.expiresAt, confirmedAt: null as Date | null, confirmedBy: null as string | null };
  const order = { id: "order-1", number: "BC-TEST-1", customerName: "Cliente", customerEmail: "cliente@example.invalid", customerPhone: "41999999999", total: 2500, status: "RECEIVED", paymentStatus: overrides.paymentStatus ?? "PENDING", trackingCode: null, trackingUrl: null, items: [{ id: "item-1", variantId: "variant-1", quantity: 1 }], payments: [payment] };
  const variant = { id: "variant-1", stock: 4, reserved: 1 };
  const reservations = overrides.reservations ?? [{ id: "reservation-1", variantId: "variant-1", quantity: 1, expiresAt: new Date(now.getTime() + 60_000), releasedAt: null as Date | null }];
  const stockMovements: unknown[] = [];
  const paymentEvents: unknown[] = [];
  const orderEvents: unknown[] = [];
  const emails: unknown[] = [];

  const tx = {
    $queryRaw: async (parts: TemplateStringsArray) => {
      const query = parts.join("");
      if (query.includes("pg_attribute")) return [{ actorId: true, actorEmail: true }];
      if (query.includes("to_regclass('public.coupon_redemptions')")) return [{ available: false }];
      return [{ id: order.id }];
    },
    $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
      orderEvents.push({ query: parts.join("?"), values });
      return 1;
    },
    order: {
      findUnique: async () => structuredClone(order),
      update: async ({ data }: { data: Partial<typeof order> }) => Object.assign(order, data),
    },
    stockReservation: {
      findMany: async () => reservations.filter((reservation) => reservation.releasedAt === null && reservation.expiresAt > now),
      updateMany: async ({ where, data }: { where: { id: string; releasedAt: null; expiresAt: { gt: Date } }; data: { releasedAt: Date } }) => {
        const reservation = reservations.find((item) => item.id === where.id && item.releasedAt === null && item.expiresAt > where.expiresAt.gt);
        if (!reservation) return { count: 0 };
        reservation.releasedAt = data.releasedAt;
        return { count: 1 };
      },
    },
    productVariant: {
      updateMany: async ({ where, data }: { where: { id: string; stock: { gte: number }; reserved: { gte: number } }; data: { stock: { decrement: number }; reserved: { decrement: number } } }) => {
        if (where.id !== variant.id || variant.stock < where.stock.gte || variant.reserved < where.reserved.gte) return { count: 0 };
        variant.stock -= data.stock.decrement;
        variant.reserved -= data.reserved.decrement;
        return { count: 1 };
      },
    },
    stockMovement: { create: async ({ data }: { data: unknown }) => { stockMovements.push(data); return data; } },
    payment: { update: async ({ data }: { data: Partial<typeof payment> }) => Object.assign(payment, data) },
    couponRedemption: { findUnique: async () => null, updateMany: async () => ({ count: 0 }) },
    paymentEvent: {
      findFirst: async ({ where }: { where: { eventType: { in: string[] } } }) => {
        const previous = [...paymentEvents].reverse().find((entry) => where.eventType.in.includes((entry as { eventType: string }).eventType));
        return previous ? { eventType: (previous as { eventType: string }).eventType } : null;
      },
      create: async ({ data }: { data: unknown }) => { paymentEvents.push(data); return data; },
    },
    orderEvent: { create: async ({ data }: { data: unknown }) => { orderEvents.push(data); return data; } },
    emailOutbox: { upsert: async ({ create }: { create: unknown }) => { emails.push(create); return create; } },
  };

  return { tx, order, payment, variant, reservations, stockMovements, paymentEvents, orderEvents, emails, now };
}

test("manual confirmation atomically approves payment, records events, and lowers reserved stock once", async () => {
  const fixture = paymentFixture();
  const result = await confirmOrderPaymentManually(fixture.tx as never, "order-1", "admin-1", "Crédito conferido", fixture.now);

  assert.equal(result.alreadyApproved, false);
  assert.equal(fixture.order.paymentStatus, "APPROVED");
  assert.equal(fixture.order.status, "PAYMENT_APPROVED");
  assert.equal(fixture.payment.confirmedBy, "admin-1");
  assert.equal(fixture.variant.stock, 3);
  assert.equal(fixture.variant.reserved, 0);
  assert.equal(fixture.reservations[0]?.releasedAt?.toISOString(), fixture.now.toISOString());
  assert.equal(fixture.stockMovements.length, 1);
  assert.equal(fixture.paymentEvents.length, 1);
  assert.equal(fixture.orderEvents.length, 1);
  assert.equal(fixture.emails.length, 1);
});

test("a repeated manual confirmation is idempotent and does not lower stock twice", async () => {
  const fixture = paymentFixture();
  await confirmOrderPaymentManually(fixture.tx as never, "order-1", "admin-1", "Crédito conferido", fixture.now);
  const repeated = await confirmOrderPaymentManually(fixture.tx as never, "order-1", "admin-1", "Crédito conferido", fixture.now);

  assert.equal(repeated.alreadyApproved, true);
  assert.equal(fixture.variant.stock, 3);
  assert.equal(fixture.variant.reserved, 0);
  assert.equal(fixture.stockMovements.length, 1);
  assert.equal(fixture.paymentEvents.length, 1);
  assert.equal(fixture.orderEvents.length, 1);
  assert.equal(fixture.emails.length, 1);
});

test("admin can mark a proof received without confirming payment or reducing stock", async () => {
  const fixture = paymentFixture();
  const input = { orderId: "order-1", status: "PROOF_RECEIVED" as const, adminUserId: "admin-1", adminEmail: "admin@example.invalid", note: "Recebido no e-mail oficial" };
  const result = await recordManualPaymentReviewStatus(fixture.tx as never, input, fixture.now);

  assert.equal(result.alreadyUpdated, false);
  assert.equal(fixture.order.paymentStatus, "PENDING");
  assert.equal(fixture.payment.paymentStatus, "PENDING");
  assert.equal(fixture.order.status, "RECEIVED");
  assert.equal(fixture.variant.stock, 4);
  assert.equal(fixture.paymentEvents.length, 1);
  assert.equal(fixture.orderEvents.length, 1);
  assert.equal(fixture.emails.length, 1);
  assert.deepEqual(fixture.orderEvents[0]?.values?.slice(1, 6), ["order-1", "RECEIVED", input.note, input.adminUserId, input.adminEmail]);
});

test("manual confirmation is allowed after proof review and records the verifying admin", async () => {
  const fixture = paymentFixture();
  await recordManualPaymentReviewStatus(fixture.tx as never, { orderId: "order-1", status: "PROOF_RECEIVED", adminUserId: "admin-1", adminEmail: "admin@example.invalid", note: "Comprovante recebido" }, fixture.now);
  await confirmOrderPaymentManually(fixture.tx as never, "order-1", "admin-1", "Crédito conferido no banco", fixture.now, "admin@example.invalid");

  assert.equal(fixture.order.paymentStatus, "APPROVED");
  assert.equal(fixture.payment.confirmedBy, "admin-1");
  assert.equal((fixture.orderEvents.at(-1) as { values: unknown[] }).values[5], "admin@example.invalid");
  assert.equal(fixture.variant.stock, 3);
});

test("marking a payment unidentified requires a reason and never approves it", async () => {
  const fixture = paymentFixture();
  const base = { orderId: "order-1", status: "UNIDENTIFIED" as const, adminUserId: "admin-1", adminEmail: "admin@example.invalid" };
  await assert.rejects(recordManualPaymentReviewStatus(fixture.tx as never, { ...base, note: " " }, fixture.now), /motivo/);
  await recordManualPaymentReviewStatus(fixture.tx as never, { ...base, note: "Não localizado no extrato" }, fixture.now);
  assert.equal(fixture.order.paymentStatus, "PENDING");
  assert.equal(fixture.payment.paymentStatus, "PENDING");
  assert.equal(fixture.variant.stock, 4);
});

test("manual confirmation rejects amount mismatch, expired payment, and missing stock reservation", async (t) => {
  await t.test("the order total and payment amount must match", async () => {
    const fixture = paymentFixture({ paymentAmount: 2501 });
    await assert.rejects(confirmOrderPaymentManually(fixture.tx as never, "order-1", "admin-1", "", fixture.now), /valor do pedido não corresponde/);
    assert.equal(fixture.variant.stock, 4);
    assert.equal(fixture.order.paymentStatus, "PENDING");
  });

  await t.test("an expired payment cannot consume reserved stock", async () => {
    const fixture = paymentFixture({ expiresAt: fixtureDateBeforeNow() });
    await assert.rejects(confirmOrderPaymentManually(fixture.tx as never, "order-1", "admin-1", "", fixture.now), /prazo de pagamento expirou/);
    assert.equal(fixture.variant.stock, 4);
    assert.equal(fixture.variant.reserved, 1);
  });

  await t.test("the reservation must still cover every item", async () => {
    const fixture = paymentFixture({ reservations: [] });
    await assert.rejects(confirmOrderPaymentManually(fixture.tx as never, "order-1", "admin-1", "", fixture.now), /reserva do pedido não está mais disponível/);
    assert.equal(fixture.variant.stock, 4);
    assert.equal(fixture.variant.reserved, 1);
  });
});

test("manual confirmation refuses a payment owned by another provider", async () => {
  const fixture = paymentFixture({ provider: "UNSUPPORTED_PROVIDER" });
  await assert.rejects(
    confirmOrderPaymentManually(fixture.tx as never, "order-1", "admin-1", "Crédito conferido", fixture.now),
    /somente para pagamentos PIX estáticos/,
  );
  assert.equal(fixture.variant.stock, 4);
  assert.equal(fixture.variant.reserved, 1);
  assert.equal(fixture.paymentEvents.length, 0);
  assert.equal(fixture.order.paymentStatus, "PENDING");
});

function fixtureDateBeforeNow() {
  return new Date("2026-11-07T17:59:00.000Z");
}
