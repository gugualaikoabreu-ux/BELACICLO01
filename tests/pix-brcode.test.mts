import assert from "node:assert/strict";
import test from "node:test";
import { buildStaticPixPayload, crc16Ccitt } from "../lib/pix/brcode.ts";

test("CRC-16/CCITT-FALSE usa o valor de referência", () => {
  assert.equal(crc16Ccitt("123456789"), "29B1");
});

test("gera BR Code PIX estático com valor, recebedor e txid normalizados", () => {
  const payload = buildStaticPixPayload(
    { key: "pix@belaciclo.com.br", merchantName: "BelaCíclo", merchantCity: "São Paulo" },
    12_345,
    "BC20261107ABC123",
  );

  assert.ok(payload.startsWith("000201010211"));
  assert.ok(payload.includes("0014br.gov.bcb.pix"));
  assert.ok(payload.includes("5406123.45"));
  assert.ok(payload.includes("5802BR"));
  assert.ok(payload.includes("5909BELACICLO"));
  assert.ok(payload.includes("6009SAO PAULO"));
  assert.ok(payload.includes("0516BC20261107ABC123"));
  assert.match(payload, /6304[0-9A-F]{4}$/);
  assert.equal(payload.slice(-4), crc16Ccitt(payload.slice(0, -4)));
});

test("rejeita valor zero, chave inválida e txid fora do formato", () => {
  const config = { key: "pix@belaciclo.com.br", merchantName: "BelaCiclo", merchantCity: "Curitiba" };
  assert.throws(() => buildStaticPixPayload(config, 0, "PEDIDO1"), /positivo/);
  assert.throws(() => buildStaticPixPayload({ ...config, key: "" }, 100, "PEDIDO1"), /chave PIX/);
  assert.throws(() => buildStaticPixPayload(config, 100, "txid-invalido"), /identificador/);
});
