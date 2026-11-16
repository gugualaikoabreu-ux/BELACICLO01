import assert from "node:assert/strict";
import test from "node:test";
import { safeInternalRedirectPath } from "../lib/supabase/redirect.ts";

test("auth callback accepts internal paths and keeps query strings", () => {
  assert.equal(safeInternalRedirectPath("/minha-conta/redefinir?token=abc"), "/minha-conta/redefinir?token=abc");
});

test("auth callback rejects external, protocol-relative, and backslash redirects", () => {
  assert.equal(safeInternalRedirectPath("https://attacker.example"), "/minha-conta");
  assert.equal(safeInternalRedirectPath("//attacker.example"), "/minha-conta");
  assert.equal(safeInternalRedirectPath("/\\attacker.example"), "/minha-conta");
  assert.equal(safeInternalRedirectPath(null), "/minha-conta");
});
