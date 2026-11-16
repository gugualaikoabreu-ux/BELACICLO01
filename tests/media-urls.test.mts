import assert from "node:assert/strict";
import test from "node:test";
import { isSafeHttpsBaseUrl } from "../lib/media/urls.ts";

test("remote media bases require HTTPS without credentials, query, or fragment", () => {
  assert.equal(isSafeHttpsBaseUrl("https://cdn.example.invalid/products"), true);
  assert.equal(isSafeHttpsBaseUrl("http://cdn.example.invalid"), false);
  assert.equal(isSafeHttpsBaseUrl("https://user:password@cdn.example.invalid"), false);
  assert.equal(isSafeHttpsBaseUrl("https://cdn.example.invalid?token=secret"), false);
  assert.equal(isSafeHttpsBaseUrl("https://cdn.example.invalid#fragment"), false);
  assert.equal(isSafeHttpsBaseUrl("not a URL"), false);
});
