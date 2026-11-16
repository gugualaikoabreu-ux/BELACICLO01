import assert from "node:assert/strict";
import test from "node:test";
import {
  CepLookupError,
  clearCepAddress,
  formatCep,
  isValidCep,
  lookupViaCep,
  mergeCepAddress,
  normalizeCep,
  updateCepAddressField,
} from "../lib/address/cep.ts";

test("CEP input is normalized and masked as 00000-000", () => {
  assert.equal(formatCep("81570001"), "81570-001");
  assert.equal(formatCep("81570-001"), "81570-001");
  assert.equal(formatCep("abc8157000199"), "81570-001");
  assert.equal(normalizeCep("81570-001"), "81570001");
  assert.equal(isValidCep("81570-001"), true);
  assert.equal(isValidCep("81570001"), true);
  assert.equal(isValidCep("81570-00"), false);
  assert.equal(isValidCep("81570-0019"), false);
  assert.equal(isValidCep("abc81570001"), false);
});

test("an incomplete CEP is rejected without calling ViaCEP", async () => {
  let calls = 0;
  await assert.rejects(
    lookupViaCep("81570-00", async () => { calls += 1; return Response.json({}); }),
    (error: unknown) => error instanceof CepLookupError && error.kind === "invalid",
  );
  assert.equal(calls, 0);
});

test("a valid CEP returns editable address fields from ViaCEP", async () => {
  let requestedUrl = "";
  const address = await lookupViaCep("81570-001", async (input, init) => {
    requestedUrl = String(input);
    assert.equal(init?.cache, "force-cache");
    return Response.json({ cep: "81570-001", logradouro: "Rua Exemplo", bairro: "Centro", localidade: "Curitiba", uf: "pr" });
  });
  assert.equal(requestedUrl, "https://viacep.com.br/ws/81570001/json/");
  assert.deepEqual(address, { postalCode: "81570001", street: "Rua Exemplo", neighborhood: "Centro", city: "Curitiba", state: "PR" });
});

test("ViaCEP not-found responses are reported distinctly", async () => {
  await assert.rejects(
    lookupViaCep("99999-999", async () => Response.json({ erro: true })),
    (error: unknown) => error instanceof CepLookupError && error.kind === "not_found",
  );
  await assert.rejects(
    lookupViaCep("99999-999", async () => Response.json({ logradouro: "", bairro: "", localidade: "", uf: "" })),
    (error: unknown) => error instanceof CepLookupError && error.kind === "not_found",
  );
});

test("network and upstream failures let the customer continue with manual entry", async () => {
  await assert.rejects(
    lookupViaCep("81570-001", async () => { throw new TypeError("offline"); }),
    (error: unknown) => error instanceof CepLookupError && error.kind === "unavailable" && error.message.includes("manualmente"),
  );
  await assert.rejects(
    lookupViaCep("81570-001", async () => new Response("", { status: 503 })),
    (error: unknown) => error instanceof CepLookupError && error.kind === "unavailable",
  );
});

test("a second CEP replaces address fields while keeping number, complement and reference", () => {
  const current = {
    street: "Rua antiga", neighborhood: "Bairro antigo", city: "Curitiba", state: "PR",
    number: "123", complement: "Apto 4", reference: "Portão azul",
  };
  const changed = clearCepAddress(current);
  assert.deepEqual(changed, {
    street: "", neighborhood: "", city: "", state: "",
    number: "123", complement: "Apto 4", reference: "Portão azul",
  });
  const resolved = mergeCepAddress(changed, {
    postalCode: "80010000", street: "Rua Nova", neighborhood: "Centro", city: "Curitiba", state: "PR",
  });
  assert.equal(resolved.street, "Rua Nova");
  assert.equal(resolved.number, "123");
  assert.equal(resolved.complement, "Apto 4");
  assert.equal(resolved.reference, "Portão azul");
});

test("manual corrections remain editable and the UF is normalized", () => {
  const current = { street: "Rua", neighborhood: "Centro", city: "Curitiba", state: "PR", number: "5" };
  const corrected = updateCepAddressField(current, "street", "Avenida corrigida");
  const correctedState = updateCepAddressField(corrected, "state", "pr");
  assert.equal(correctedState.street, "Avenida corrigida");
  assert.equal(correctedState.state, "PR");
  assert.equal(correctedState.number, "5");
});
