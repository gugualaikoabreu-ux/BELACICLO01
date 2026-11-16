import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const confirmation = "I_UNDERSTAND_THIS_IS_A_TEST_PROJECT";
const databaseUrl = process.env.DATABASE_URL_TEST;
const directDatabaseUrl = process.env.DIRECT_DATABASE_URL_TEST;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.BELACICLO_TEST_DB_CONFIRM !== confirmation) {
  throw new Error(`Defina BELACICLO_TEST_DB_CONFIRM=${confirmation} somente para um projeto de teste.`);
}
if (process.env.BELACICLO_TEST_DB_MODE !== "true") throw new Error("Defina BELACICLO_TEST_DB_MODE=true no arquivo .env.test.");
if (!databaseUrl) throw new Error("DATABASE_URL_TEST não configurada em .env.test.");
if (!supabaseUrl || !publishableKey || !secretKey) {
  throw new Error("Preencha NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY do projeto de teste.");
}

function projectReference(url) {
  const direct = url.hostname.match(/^db\.([^.]+)\.supabase\.co$/i)?.[1];
  const pooled = decodeURIComponent(url.username).match(/(?:^|\.)postgres\.([^.]+)$/i)?.[1];
  return direct ?? pooled ?? null;
}

const testDatabaseUrls = [databaseUrl, directDatabaseUrl].filter(Boolean);
const apiUrl = new URL(supabaseUrl);
const apiProjectRef = apiUrl.hostname.match(/^([^.]+)\.supabase\.co$/i)?.[1] ?? null;
const testProjectRefs = testDatabaseUrls.map((url) => projectReference(new URL(url)));
if (testProjectRefs.some((reference) => !reference)) {
  throw new Error("As URLs de banco de teste precisam identificar um host Supabase reconhecido.");
}
if (apiProjectRef && testProjectRefs.some((reference) => reference !== apiProjectRef)) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL e as conexões de banco pertencem a projetos Supabase diferentes.");
}

function sameDatabaseEndpoint(left, right) {
  return left.hostname.toLowerCase() === right.hostname.toLowerCase()
    && (left.port || "5432") === (right.port || "5432")
    && left.pathname === right.pathname;
}

for (const productionUrl of [process.env.DATABASE_URL, process.env.DIRECT_DATABASE_URL].filter(Boolean)) {
  const production = new URL(productionUrl);
  const productionProjectRef = projectReference(production);
  const sameProject = productionProjectRef && testProjectRefs.includes(productionProjectRef);
  const sameEndpoint = testDatabaseUrls.some((testUrl) => sameDatabaseEndpoint(new URL(testUrl), production));
  if (sameProject || sameEndpoint) throw new Error("Uma conexão de teste aponta para produção. Use um projeto Supabase separado.");
}

const db = new Client({ connectionString: databaseUrl, application_name: "belaciclo-test-db-verification" });
const adminClient = createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
const publicClient = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const fixtures = {
  productId: randomUUID(), variantId: randomUUID(), orderA: randomUUID(), orderB: randomUUID(), itemA: randomUUID(), itemB: randomUUID(), paymentA: randomUUID(), paymentB: randomUUID(),
  addressA: randomUUID(), addressB: randomUUID(), favoriteA: randomUUID(), favoriteB: randomUUID(), orderEventA: randomUUID(), orderEventB: randomUUID(), shipmentA: randomUUID(), shipmentB: randomUUID(),
};
const users = [];
let connected = false;
let transactionOpen = false;

const migrationRoot = new URL("../prisma/migrations/", import.meta.url);
const migrationDirectories = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name));
const expectedMigrations = await Promise.all(migrationDirectories.map(async ({ name }) => {
  const sql = await readFile(new URL(`${name}/migration.sql`, migrationRoot));
  return { name, checksum: createHash("sha256").update(sql).digest("hex") };
}));

function check(condition, message) {
  assert.ok(condition, message);
  console.log(`✓ ${message}`);
}

async function createTestUser(label) {
  const email = `belaciclo-${label}-${suffix}@example.invalid`;
  const password = `${randomBytes(32).toString("base64url")}aA1!`;
  const created = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`Não foi possível criar a conta temporária de teste: ${created.error?.message ?? "sem usuário retornado"}`);
  users.push({ id: created.data.user.id, email });

  const client = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.user) throw new Error(`Não foi possível autenticar a conta temporária de teste: ${signedIn.error?.message ?? "sem sessão retornada"}`);
  return { id: signedIn.data.user.id, email, client };
}

try {
  await db.connect();
  connected = true;
  const current = await db.query("SELECT current_database() AS name");
  console.log(`Conectado ao banco Supabase de teste: ${current.rows[0].name}`);

  const tables = await db.query(`
    SELECT c.relname AS name, c.relrowsecurity AS rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `);
  const byName = new Map(tables.rows.map((row) => [row.name, row]));
  const expectedTables = ["customers", "addresses", "categories", "products", "product_images", "product_variants", "stock_movements", "product_relations", "favorites", "orders", "order_items", "stock_reservations", "order_events", "payments", "payment_events", "shipments", "admin_users", "newsletter_subscriptions", "campaigns", "coupons", "rate_limit_buckets", "email_outbox"];
  check(expectedTables.every((name) => byName.has(name)), "tabelas de clientes, catálogo, estoque, pedidos, pagamentos e administração existem");
  check(expectedTables.every((name) => byName.get(name)?.rls), "RLS está habilitada em todas as tabelas da API pública");

  const migrationHistory = await db.query(`
    SELECT migration_name, checksum, finished_at, rolled_back_at
    FROM public."_prisma_migrations"
    WHERE rolled_back_at IS NULL
    ORDER BY migration_name
  `);
  const actualMigrations = new Map(migrationHistory.rows.map((row) => [row.migration_name, row]));
  check(
    migrationHistory.rows.length === expectedMigrations.length
      && expectedMigrations.every((expected) => {
        const actual = actualMigrations.get(expected.name);
        return actual?.checksum === expected.checksum && actual.finished_at !== null;
      }),
    "histórico Prisma corresponde às migrações locais e todas estão concluídas",
  );

  const policies = await db.query("SELECT policyname FROM pg_policies WHERE schemaname = 'public'");
  const policyNames = new Set(policies.rows.map((row) => row.policyname));
  check(["products_public_read", "customers_self_read", "addresses_self_read", "orders_self_read", "order_items_self_read", "payments_self_read"].every((name) => policyNames.has(name)), "políticas do catálogo e de leitura dos próprios dados estão instaladas");

  const grants = await db.query(`
    SELECT has_column_privilege('anon', 'public.product_variants', 'stock', 'SELECT') AS anon_stock,
           has_column_privilege('authenticated', 'public.product_variants', 'reserved', 'SELECT') AS customer_reserved,
           has_table_privilege('authenticated', 'public.orders', 'INSERT') AS customer_order_insert,
           has_table_privilege('authenticated', 'public.payments', 'UPDATE') AS customer_payment_update,
           has_table_privilege('anon', 'public.admin_users', 'SELECT') AS anon_admin_read
  `);
  check(!grants.rows[0].anon_stock && !grants.rows[0].customer_reserved, "estoque exato não é exposto pela API pública");
  check(!grants.rows[0].customer_order_insert && !grants.rows[0].customer_payment_update && !grants.rows[0].anon_admin_read, "clientes não criam pedidos, aprovam pagamentos ou leem a tabela administrativa");

  const foreignKeyIndexes = await db.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ANY($1::text[])
  `, [["favorites_productId_idx", "order_items_orderId_idx", "order_items_productId_idx", "order_items_variantId_idx", "product_relations_relatedId_idx", "stock_reservations_variantId_idx"]]);
  check(foreignKeyIndexes.rows.length === 6, "índices de consulta das chaves estrangeiras estão instalados");

  const constraints = await db.query("SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[])", [["product_variants_stock_check", "orders_amounts_check", "order_items_amounts_check", "payments_amount_check", "payment_events_amount_check"]]);
  check(constraints.rows.length === 5, "restrições de valores e estoque estão aplicadas no PostgreSQL");
  const authTrigger = await db.query("SELECT count(*)::int AS count FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'belaciclo_auth_user_sync' AND NOT tgisinternal");
  check(authTrigger.rows[0].count === 1, "sincronização entre Supabase Auth e customers está instalada");
  const rlsHelper = await db.query(`
    SELECT to_regprocedure('public.rls_auto_enable()') IS NOT NULL AS installed,
           COALESCE(has_function_privilege('anon', to_regprocedure('public.rls_auto_enable()'), 'EXECUTE'), false) AS anon_execute,
           COALESCE(has_function_privilege('authenticated', to_regprocedure('public.rls_auto_enable()'), 'EXECUTE'), false) AS authenticated_execute
  `);
  if (rlsHelper.rows[0].installed) {
    check(!rlsHelper.rows[0].anon_execute && !rlsHelper.rows[0].authenticated_execute, "clientes anônimos e autenticados não podem executar a função SECURITY DEFINER de RLS");
  }
  const categories = await db.query("SELECT count(*)::int AS count FROM public.categories WHERE slug IN ('feminina-geral', 'infantil-geral')");
  check(categories.rows[0].count === 2, "categorias iniciais feminina e infantil estão cadastradas");

  const userA = await createTestUser("rls-a");
  const userB = await createTestUser("rls-b");
  const synced = await db.query('SELECT id, "emailVerified" FROM public.customers WHERE id = ANY($1::text[])', [[userA.id, userB.id]]);
  check(synced.rows.length === 2 && synced.rows.every((row) => row.emailVerified), "cadastro Supabase Auth sincroniza clientes com e-mail confirmado");

  await db.query("BEGIN");
  transactionOpen = true;
  await db.query(`
    INSERT INTO public.products (id, slug, name, department, description, category, price, active, demo, "createdAt", "updatedAt")
    VALUES ($1, $2, 'Peça de teste RLS', 'FEMININA', 'Registro descartável para testar permissões', 'Moda feminina', 1000, true, false, now(), now())
  `, [fixtures.productId, `rls-test-${suffix}`]);
  await db.query(`
    INSERT INTO public.product_variants (id, "productId", size, color, stock, reserved, active, "updatedAt")
    VALUES ($1, $2, 'M', 'Azul', 3, 1, true, now())
  `, [fixtures.variantId, fixtures.productId]);

  async function addOrder(id, user, label, itemId, paymentId) {
    await db.query(`
      INSERT INTO public.orders (id, number, "userId", "customerName", "customerEmail", "customerPhone", subtotal, shipping, discount, total, "shippingAddress", "idempotencyKey", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, '41999999999', 1000, 0, 0, 1000, '{}'::jsonb, $6, now(), now())
    `, [id, `TEST-${suffix}-${label}`, user.id, `Cliente ${label}`, user.email, `key-${suffix}-${label}`]);
    await db.query(`
      INSERT INTO public.order_items (id, "orderId", "productId", "variantId", name, size, color, "unitPrice", quantity, subtotal)
      VALUES ($1, $2, $3, $4, 'Peça de teste RLS', 'M', 'Azul', 1000, 1, 1000)
    `, [itemId, id, fixtures.productId, fixtures.variantId]);
    await db.query(`
      INSERT INTO public.payments (id, "orderId", provider, amount, "paymentMethod", "paymentStatus", "createdAt", "updatedAt")
      VALUES ($1, $2, 'TEST_FIXTURE', 1000, 'PIX', 'PENDING', now(), now())
    `, [paymentId, id]);
  }

  await addOrder(fixtures.orderA, userA, "A", fixtures.itemA, fixtures.paymentA);
  await addOrder(fixtures.orderB, userB, "B", fixtures.itemB, fixtures.paymentB);
  for (const [addressId, user, label] of [[fixtures.addressA, userA, "A"], [fixtures.addressB, userB, "B"]]) {
    await db.query(`
      INSERT INTO public.addresses (id, "userId", recipient, "postalCode", street, number, neighborhood, city, state)
      VALUES ($1, $2, $3, '80000000', 'Rua de teste', '1', 'Centro', 'Curitiba', 'PR')
    `, [addressId, user.id, `Cliente ${label}`]);
  }
  await db.query(`INSERT INTO public.favorites ("userId", "productId") VALUES ($1, $2), ($3, $2)`, [userA.id, fixtures.productId, userB.id]);
  await db.query(`
    INSERT INTO public.order_events (id, "orderId", status, note) VALUES
      ($1, $2, 'RECEIVED', 'Evento de teste A'), ($3, $4, 'RECEIVED', 'Evento de teste B')
  `, [fixtures.orderEventA, fixtures.orderA, fixtures.orderEventB, fixtures.orderB]);
  await db.query(`
    INSERT INTO public.shipments (id, "orderId", carrier, "shippingStatus", "updatedAt") VALUES
      ($1, $2, 'TEST', 'PENDING', now()), ($3, $4, 'TEST', 'PENDING', now())
  `, [fixtures.shipmentA, fixtures.orderA, fixtures.shipmentB, fixtures.orderB]);
  await db.query("COMMIT");
  transactionOpen = false;

  const customerA = await userA.client.from("customers").select("id").in("id", [userA.id, userB.id]);
  check(!customerA.error && customerA.data?.length === 1 && customerA.data[0].id === userA.id, "cliente A só consulta o próprio cadastro");
  const addressesA = await userA.client.from("addresses").select("id").in("id", [fixtures.addressA, fixtures.addressB]);
  check(!addressesA.error && addressesA.data?.length === 1 && addressesA.data[0].id === fixtures.addressA, "cliente A só consulta os próprios endereços");
  const favoritesA = await userA.client.from("favorites").select("productId").eq("productId", fixtures.productId);
  check(!favoritesA.error && favoritesA.data?.length === 1, "favoritos de cada cliente permanecem isolados por conta");
  const ordersA = await userA.client.from("orders").select("id").in("id", [fixtures.orderA, fixtures.orderB]);
  check(!ordersA.error && ordersA.data?.length === 1 && ordersA.data[0].id === fixtures.orderA, "cliente A só consulta os próprios pedidos");
  const itemsA = await userA.client.from("order_items").select("id,orderId").in("orderId", [fixtures.orderA, fixtures.orderB]);
  check(!itemsA.error && itemsA.data?.length === 1 && itemsA.data[0].orderId === fixtures.orderA, "cliente A só consulta itens dos próprios pedidos");
  const paymentsA = await userA.client.from("payments").select("id,orderId").in("orderId", [fixtures.orderA, fixtures.orderB]);
  check(!paymentsA.error && paymentsA.data?.length === 1 && paymentsA.data[0].orderId === fixtures.orderA, "cliente A só consulta pagamentos dos próprios pedidos");
  const eventsA = await userA.client.from("order_events").select("id,orderId").in("orderId", [fixtures.orderA, fixtures.orderB]);
  check(!eventsA.error && eventsA.data?.length === 1 && eventsA.data[0].orderId === fixtures.orderA, "cliente A só consulta eventos dos próprios pedidos");
  const shipmentsA = await userA.client.from("shipments").select("id,orderId").in("orderId", [fixtures.orderA, fixtures.orderB]);
  check(!shipmentsA.error && shipmentsA.data?.length === 1 && shipmentsA.data[0].orderId === fixtures.orderA, "cliente A só consulta entregas dos próprios pedidos");
  const ordersB = await userB.client.from("orders").select("id").in("id", [fixtures.orderA, fixtures.orderB]);
  check(!ordersB.error && ordersB.data?.length === 1 && ordersB.data[0].id === fixtures.orderB, "cliente B só consulta os próprios pedidos");

  const publicProduct = await publicClient.from("products").select("id").eq("id", fixtures.productId);
  check(!publicProduct.error && publicProduct.data?.length === 1, "catálogo ativo fica disponível ao público");
  const publicVariant = await publicClient.from("product_variants").select("id,size,color,active").eq("id", fixtures.variantId);
  check(!publicVariant.error && publicVariant.data?.length === 1, "variações públicas são legíveis sem mostrar quantidade em estoque");
  const publicStock = await publicClient.from("product_variants").select("stock").eq("id", fixtures.variantId);
  check(Boolean(publicStock.error), "a API bloqueia a leitura pública da quantidade de estoque");
  const adminTable = await userA.client.from("admin_users").select("id").limit(1);
  check(Boolean(adminTable.error), "a API não expõe diretamente a tabela administrativa");
  const alteredOrder = await userA.client.from("orders").update({ total: 1 }).eq("id", fixtures.orderA);
  check(Boolean(alteredOrder.error), "cliente não altera preços nem totais do pedido");
  const approvedPayment = await userA.client.from("payments").update({ paymentStatus: "APPROVED" }).eq("id", fixtures.paymentA);
  check(Boolean(approvedPayment.error), "cliente não consegue aprovar o próprio pagamento");
  const changedOrderStatus = await userA.client.from("orders").update({ status: "DELIVERED" }).eq("id", fixtures.orderA);
  check(Boolean(changedOrderStatus.error), "cliente não altera o status de entrega do pedido");

  const duplicateEventId = `test-event-${suffix}`;
  await db.query(`INSERT INTO public.payment_events (id, provider, "providerEventId", "orderId", "paymentId", amount, "eventType") VALUES ($1, 'TEST', $2, $3, $4, 1000, 'TEST')`, [randomUUID(), duplicateEventId, fixtures.orderA, fixtures.paymentA]);
  let duplicateEventRejected = false;
  try {
    await db.query(`INSERT INTO public.payment_events (id, provider, "providerEventId", "orderId", "paymentId", amount, "eventType") VALUES ($1, 'TEST', $2, $3, $4, 1000, 'TEST')`, [randomUUID(), duplicateEventId, fixtures.orderA, fixtures.paymentA]);
  } catch (error) { duplicateEventRejected = error?.code === "23505"; }
  check(duplicateEventRejected, "eventos de pagamento repetidos são rejeitados pelo índice de idempotência");

  let invalidStockRejected = false;
  try { await db.query(`UPDATE public.product_variants SET stock = 0 WHERE id = $1`, [fixtures.variantId]); }
  catch (error) { invalidStockRejected = error?.code === "23514"; }
  check(invalidStockRejected, "o banco impede que o estoque fique abaixo das unidades reservadas");

  const contenderA = new Client({ connectionString: databaseUrl, application_name: "belaciclo-stock-test-a" });
  const contenderB = new Client({ connectionString: databaseUrl, application_name: "belaciclo-stock-test-b" });
  let contenderATransactionOpen = false;
  try {
    await Promise.all([contenderA.connect(), contenderB.connect()]);
    await db.query(`UPDATE public.product_variants SET stock = 1, reserved = 0 WHERE id = $1`, [fixtures.variantId]);
    await contenderA.query("BEGIN");
    contenderATransactionOpen = true;
    const winner = await contenderA.query(`UPDATE public.product_variants SET reserved = reserved + 1 WHERE id = $1 AND active = true AND stock - reserved >= 1`, [fixtures.variantId]);
    const loserPromise = contenderB.query(`UPDATE public.product_variants SET reserved = reserved + 1 WHERE id = $1 AND active = true AND stock - reserved >= 1`, [fixtures.variantId]);
    await contenderA.query("COMMIT");
    contenderATransactionOpen = false;
    const loser = await loserPromise;
    check(winner.rowCount === 1 && loser.rowCount === 0, "duas compras simultâneas não reservam a mesma última unidade");
  } finally {
    if (contenderATransactionOpen) await contenderA.query("ROLLBACK").catch(() => undefined);
    await Promise.all([contenderA.end().catch(() => undefined), contenderB.end().catch(() => undefined)]);
    await db.query(`UPDATE public.product_variants SET stock = 3, reserved = 1 WHERE id = $1`, [fixtures.variantId]).catch(() => undefined);
  }

  console.log("Verificação de banco e RLS concluída sem pagamentos reais.");
} catch (error) {
  if (transactionOpen) await db.query("ROLLBACK").catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (connected) {
    await db.query("DELETE FROM public.orders WHERE id = ANY($1::text[])", [[fixtures.orderA, fixtures.orderB]]).catch(() => undefined);
    await db.query("DELETE FROM public.product_variants WHERE id = $1", [fixtures.variantId]).catch(() => undefined);
    await db.query("DELETE FROM public.products WHERE id = $1", [fixtures.productId]).catch(() => undefined);
    await db.end().catch(() => undefined);
  }
  for (const user of users) {
    const deleted = await adminClient.auth.admin.deleteUser(user.id);
    if (deleted.error) {
      console.error(`Não foi possível remover o usuário temporário ${user.email}: ${deleted.error.message}`);
      process.exitCode = 1;
    }
  }
}
