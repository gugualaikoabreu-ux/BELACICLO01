import assert from "node:assert/strict";
import test from "node:test";
import { categorySlug } from "../lib/category-slug.ts";

test("category slugs normalize accents and scope names by department", () => {
  assert.equal(categorySlug("Roupas de Verão", "FEMININA"), "feminina-roupas-de-verao");
  assert.equal(categorySlug("Roupas de Verão", "INFANTIL"), "infantil-roupas-de-verao");
});
