import assert from "node:assert/strict";
import test from "node:test";
import { resolvePrismaDatasourceUrl } from "../lib/prisma-datasource.ts";

const confirmation = "I_UNDERSTAND_THIS_IS_A_TEST_PROJECT";
const api = "https://testref123.supabase.co";
const testDatabase = "postgresql://postgres:secret@db.testref123.supabase.co:5432/postgres?sslmode=require";

test("test migrations use the test connection, not the production connection", () => {
  const target = resolvePrismaDatasourceUrl({
    BELACICLO_TEST_DB_MODE: "true",
    BELACICLO_TEST_DB_CONFIRM: confirmation,
    NEXT_PUBLIC_SUPABASE_URL: api,
    DATABASE_URL_TEST: testDatabase,
    DATABASE_URL: "postgresql://postgres:secret@db.prodref456.supabase.co:5432/postgres?sslmode=require",
  });
  assert.equal(target, testDatabase);
});

test("a direct test connection must belong to the selected test project", () => {
  assert.throws(() => resolvePrismaDatasourceUrl({
    BELACICLO_TEST_DB_MODE: "true",
    BELACICLO_TEST_DB_CONFIRM: confirmation,
    NEXT_PUBLIC_SUPABASE_URL: api,
    DATABASE_URL_TEST: testDatabase,
    DIRECT_DATABASE_URL_TEST: "postgresql://postgres:secret@db.prodref456.supabase.co:5432/postgres?sslmode=require",
  }), /mesmo projeto indicado por DATABASE_URL_TEST/);
});

test("test migrations refuse a project also configured as production", () => {
  assert.throws(() => resolvePrismaDatasourceUrl({
    BELACICLO_TEST_DB_MODE: "true",
    BELACICLO_TEST_DB_CONFIRM: confirmation,
    NEXT_PUBLIC_SUPABASE_URL: api,
    DATABASE_URL_TEST: testDatabase,
    DIRECT_DATABASE_URL: "postgresql://postgres:secret@db.testref123.supabase.co:5432/postgres?sslmode=require",
  }), /mesmo projeto Supabase de produção/);
});

test("test migrations require an explicit test-project confirmation", () => {
  assert.throws(() => resolvePrismaDatasourceUrl({
    BELACICLO_TEST_DB_MODE: "true",
    NEXT_PUBLIC_SUPABASE_URL: api,
    DATABASE_URL_TEST: testDatabase,
  }), /projeto Supabase exclusivo para testes/);
});

test("production mode retains the configured direct database connection", () => {
  const direct = "postgresql://postgres:secret@db.prodref456.supabase.co:5432/postgres?sslmode=require";
  assert.equal(resolvePrismaDatasourceUrl({ DIRECT_DATABASE_URL: direct }), direct);
});
