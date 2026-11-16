import assert from "node:assert/strict";
import test from "node:test";
import { ManualPixProvider } from "../lib/payments/manual-pix-provider.ts";
import { getConfiguredPaymentProvider } from "../lib/payments/service.ts";
import { PaymentUnavailableError } from "../lib/payments/provider.ts";
import { crc16Ccitt } from "../lib/pix/brcode.ts";

const envKeys = ["PIX_MODE", "PIX_STATIC_KEY", "PIX_MERCHANT_NAME", "PIX_MERCHANT_CITY"] as const;

async function withPixEnvironment(values: Partial<Record<(typeof envKeys)[number], string | undefined>>, run: () => Promise<void>) {
  const previous = new Map(envKeys.map((key) => [key, process.env[key]]));
  for (const key of envKeys) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try { await run(); }
  finally {
    for (const key of envKeys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const chargeInput = { amountCents: 12_345, orderNumber: "BC-20261107-ABC123", expiresAt: new Date("2026-11-07T18:00:00.000Z") };

test("checkout selects only the local manual PIX provider", () => {
  assert.equal(getConfiguredPaymentProvider().name, "MANUAL_PIX_STATIC");
});

test("manual PIX stays unavailable until the official key and bank recipient are configured", async () => {
  await withPixEnvironment({}, async () => {
    await assert.rejects(new ManualPixProvider().createPixCharge(chargeInput), PaymentUnavailableError);
  });
});

test("manual provider creates an order-specific amount-coded BR Code", async () => {
  const pixKey = "pix-test-key@example.invalid";
  await withPixEnvironment({ PIX_MODE: "manual", PIX_STATIC_KEY: pixKey, PIX_MERCHANT_NAME: "BelaCiclo Teste", PIX_MERCHANT_CITY: "Curitiba" }, async () => {
    const charge = await new ManualPixProvider().createPixCharge(chargeInput);
    assert.equal(charge.provider, "MANUAL_PIX_STATIC");
    assert.equal(charge.recipientName, "BelaCiclo Teste");
    assert.equal(charge.transactionId, "BCBC20261107ABC123");
    assert.ok(charge.copyPaste.includes("5406123.45"));
    assert.ok(charge.copyPaste.endsWith(crc16Ccitt(charge.copyPaste.slice(0, -4))));
    assert.equal(charge.qrCodeReference, null);
  });
});

test("automatic provider modes are rejected", async () => {
  await withPixEnvironment({ PIX_MODE: "mercadopago", PIX_STATIC_KEY: "test-key", PIX_MERCHANT_NAME: "BelaCiclo Teste", PIX_MERCHANT_CITY: "Curitiba" }, async () => {
    await assert.rejects(new ManualPixProvider().createPixCharge(chargeInput), /exclusivamente PIX manual/);
  });
});

test("manual PIX refuses missing account holder details", async () => {
  await withPixEnvironment({ PIX_MODE: "manual", PIX_STATIC_KEY: "test-key", PIX_MERCHANT_CITY: "Curitiba" }, async () => {
    await assert.rejects(new ManualPixProvider().createPixCharge(chargeInput), /nome do titular da chave/);
  });
});
