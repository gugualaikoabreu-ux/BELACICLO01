import assert from "node:assert/strict";
import test from "node:test";
import { isSameOriginMutationRequest } from "../lib/security/same-origin.ts";

test("same-origin mutations pass and cross-origin mutations fail", () => {
  assert.equal(isSameOriginMutationRequest(new Request("https://store.example/api/admin", { method: "POST", headers: { origin: "https://store.example" } })), true);
  assert.equal(isSameOriginMutationRequest(new Request("https://store.example/api/admin", { method: "PATCH", headers: { origin: "https://attacker.example" } })), false);
});

test("cross-site fetch metadata is rejected when Origin is absent", () => {
  assert.equal(isSameOriginMutationRequest(new Request("https://store.example/api/admin", { method: "POST", headers: { "sec-fetch-site": "cross-site" } })), false);
  assert.equal(isSameOriginMutationRequest(new Request("https://store.example/api/admin", { method: "POST", headers: { "sec-fetch-site": "same-origin" } })), true);
});

test("safe reads do not require an Origin header", () => {
  assert.equal(isSameOriginMutationRequest(new Request("https://store.example/api/admin", { method: "GET", headers: { "sec-fetch-site": "cross-site" } })), true);
});
