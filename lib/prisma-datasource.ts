const TEST_CONFIRMATION = "I_UNDERSTAND_THIS_IS_A_TEST_PROJECT";

type DatabaseEnvironment = Record<string, string | undefined>;

function projectRefFromApiUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  return url.hostname.match(/^([^.]+)\.supabase\.co$/i)?.[1] ?? null;
}

function projectRefFromDatabaseUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const direct = url.hostname.match(/^db\.([^.]+)\.supabase\.co$/i)?.[1];
  const pooled = decodeURIComponent(url.username).match(/(?:^|\.)postgres\.([^.]+)$/i)?.[1];
  return direct ?? pooled ?? null;
}

function sameDatabaseEndpoint(left: string, right: string) {
  const a = new URL(left);
  const b = new URL(right);
  return a.hostname.toLowerCase() === b.hostname.toLowerCase()
    && (a.port || "5432") === (b.port || "5432")
    && a.pathname === b.pathname;
}

export function resolvePrismaDatasourceUrl(environment: DatabaseEnvironment) {
  const testMode = environment.BELACICLO_TEST_DB_MODE === "true";
  if (!testMode) {
    const productionUrl = environment.DIRECT_DATABASE_URL || environment.DATABASE_URL;
    if (!productionUrl) throw new Error("Configure DATABASE_URL antes de executar migrações.");
    return productionUrl;
  }

  if (environment.BELACICLO_TEST_DB_CONFIRM !== TEST_CONFIRMATION) {
    throw new Error(`Confirme o uso de um projeto Supabase exclusivo para testes em BELACICLO_TEST_DB_CONFIRM=${TEST_CONFIRMATION}.`);
  }

  const testDatabaseUrl = environment.DATABASE_URL_TEST;
  const testApiUrl = environment.NEXT_PUBLIC_SUPABASE_URL;
  if (!testDatabaseUrl || !testApiUrl) {
    throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e DATABASE_URL_TEST do mesmo projeto Supabase de teste.");
  }

  const testProjectRef = projectRefFromDatabaseUrl(testDatabaseUrl);
  if (!testProjectRef) throw new Error("DATABASE_URL_TEST não identifica um host de banco Supabase reconhecido.");
  const apiProjectRef = projectRefFromApiUrl(testApiUrl);
  if (apiProjectRef && apiProjectRef !== testProjectRef) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL e DATABASE_URL_TEST pertencem a projetos diferentes.");
  }

  const directTestUrl = environment.DIRECT_DATABASE_URL_TEST;
  if (directTestUrl) {
    const directTestProjectRef = projectRefFromDatabaseUrl(directTestUrl);
    if (!directTestProjectRef || directTestProjectRef !== testProjectRef) {
      throw new Error("DIRECT_DATABASE_URL_TEST precisa pertencer ao mesmo projeto indicado por DATABASE_URL_TEST.");
    }
  }

  for (const productionUrl of [environment.DATABASE_URL, environment.DIRECT_DATABASE_URL]) {
    if (!productionUrl) continue;
    const productionProjectRef = projectRefFromDatabaseUrl(productionUrl);
    if (productionProjectRef && productionProjectRef === testProjectRef) {
      throw new Error("A configuração de teste aponta para o mesmo projeto Supabase de produção.");
    }
    if (sameDatabaseEndpoint(testDatabaseUrl, productionUrl) || (directTestUrl && sameDatabaseEndpoint(directTestUrl, productionUrl))) {
      throw new Error("A URL de teste aponta para o mesmo banco configurado como produção.");
    }
  }

  return directTestUrl || testDatabaseUrl;
}
