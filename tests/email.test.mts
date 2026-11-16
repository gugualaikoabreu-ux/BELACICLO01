import assert from "node:assert/strict";
import test from "node:test";
import { sendTransactionalEmail } from "../lib/email.ts";

test("transactional email forwards the outbox idempotency key to Resend", async () => {
  const previous = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  const originalFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = "unit-test-resend-key";
  process.env.EMAIL_FROM = "BelaCiclo <test@example.invalid>";
  let request: { input: string; init?: RequestInit } | undefined;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    request = { input: String(input), init };
    return Response.json({ id: "email-test-id" });
  }) as typeof fetch;
  try {
    await sendTransactionalEmail({ to: "cliente@example.invalid", subject: "Pedido recebido", html: "<p>Pedido</p>", idempotencyKey: "order:test-order:received" });
    assert.equal(request?.input, "https://api.resend.com/emails");
    assert.equal(new Headers(request?.init?.headers).get("idempotency-key"), "order:test-order:received");
    assert.ok(request?.init?.signal instanceof AbortSignal);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous.key;
    if (previous.from === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = previous.from;
  }
});

test("transactional email refuses an invalid idempotency key before contacting Resend", async () => {
  const previous = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  process.env.RESEND_API_KEY = "unit-test-resend-key";
  process.env.EMAIL_FROM = "BelaCiclo <test@example.invalid>";
  try {
    await assert.rejects(sendTransactionalEmail({ to: "cliente@example.invalid", subject: "Pedido recebido", html: "<p>Pedido</p>", idempotencyKey: " " }), /Chave idempotente/);
  } finally {
    if (previous.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous.key;
    if (previous.from === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = previous.from;
  }
});
