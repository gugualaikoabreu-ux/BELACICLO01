import { getDb } from "@/lib/db";
import { ShippingUnavailableError } from "@/lib/shipping/manual";
import { combinePackageDimensions, parseBrazilianAmountToCents } from "@/lib/shipping/calculation";

export type ShippingLine = { variantId: string; quantity: number };
export type CorreiosOption = { code: string; name: string; shippingCents: number; deliveryDays: number };

type CorreiosSettings = { priceRoot: string; deadlineRoot: string; tokenRoot: string; origin: string; contract?: string; dr?: string; services: { code: string; name: string }[]; idCorreios: string; apiAccessCode: string; postingCard: string };
type CorreiosTokenResponse = { token?: unknown; expiraEm?: unknown };
type JsonRecord = Record<string, unknown>;
type CachedToken = { token: string; expiresAt: number };

const DEFAULT_ORIGIN_CEP = "81570001";
const DEFAULT_SERVICE_CODES = "03220:SEDEX,03298:PAC";
const REQUIRED_CREDENTIALS = [
  ["CORREIOS_ID_CORREIOS", "Usuário/ID dos Correios"],
  ["CORREIOS_API_ACCESS_CODE", "Código de acesso às APIs do CWS"],
  ["CORREIOS_CONTRACT", "Número do contrato Correios"],
  ["CORREIOS_POSTING_CARD", "Cartão de postagem ativo"],
  ["CORREIOS_DR", "Diretoria Regional (DR) do contrato"],
] as const;

let cachedToken: CachedToken | null = null;
let tokenRequest: Promise<string> | null = null;

const cleanPostalCode = (value: string) => value.replace(/\D/g, "");
const read = (key: string) => (process.env[key] ?? "").trim();

function parseServices(raw: string) {
  return raw.split(",").map((entry) => {
    const [code, name] = entry.trim().split(":");
    return { code: code?.trim() ?? "", name: name?.trim() ?? "" };
  }).filter((service) => /^\d{3,8}$/.test(service.code) && service.name);
}

export function getCorreiosSetupStatus() {
  const configuredMode = read("CORREIOS_MODE") || "homologation";
  const modeIsValid = configuredMode === "production" || configuredMode === "homologation";
  const mode = modeIsValid ? configuredMode : "homologation";
  const origin = cleanPostalCode(read("CORREIOS_ORIGIN_CEP") || DEFAULT_ORIGIN_CEP);
  const contract = read("CORREIOS_CONTRACT");
  const dr = read("CORREIOS_DR");
  const services = parseServices(read("CORREIOS_SERVICE_CODES") || DEFAULT_SERVICE_CODES);
  const missing: string[] = REQUIRED_CREDENTIALS.filter(([key]) => !read(key)).map(([, label]) => label);
  if (!modeIsValid) missing.push("ambiente válido (CORREIOS_MODE)");
  if (!/^\d{8}$/.test(origin)) missing.push("CEP de origem válido (CORREIOS_ORIGIN_CEP)");
  if (!services.length) missing.push("códigos de serviços PAC/SEDEX (CORREIOS_SERVICE_CODES)");
  if (contract && !/^\d+$/.test(contract)) missing.push("número de contrato válido (CORREIOS_CONTRACT)");
  if (dr && !/^\d+$/.test(dr)) missing.push("número de DR válido (CORREIOS_DR)");
  return {
    mode,
    origin,
    services,
    missing,
    ready: missing.length === 0,
    contractConfigured: Boolean(contract),
    drConfigured: Boolean(dr),
  };
}

export function hasCorreiosSettings() {
  return getCorreiosSetupStatus().ready;
}

function getSettings(originPostalCode?: string): CorreiosSettings {
  const status = getCorreiosSetupStatus();
  if (!status.ready) throw new ShippingUnavailableError("A integração com os Correios ainda não está configurada.");
  const mode = status.mode;
  const idCorreios = read("CORREIOS_ID_CORREIOS");
  const apiAccessCode = read("CORREIOS_API_ACCESS_CODE");
  const postingCard = read("CORREIOS_POSTING_CARD");
  const origin = cleanPostalCode(originPostalCode ?? status.origin);
  if (!/^\d{8}$/.test(origin)) throw new ShippingUnavailableError("Configure um CEP de origem válido no painel de frete.");
  const contract = read("CORREIOS_CONTRACT");
  const dr = read("CORREIOS_DR");
  const services = status.services;
  const host = mode === "homologation" ? "https://apihom.correios.com.br" : "https://api.correios.com.br";
  return { priceRoot: `${host}/preco/v3`, deadlineRoot: `${host}/prazo/v3`, tokenRoot: `${host}/token`, origin, ...(contract ? { contract } : {}), ...(dr ? { dr } : {}), services, idCorreios, apiAccessCode, postingCard };
}

function hasValue(value: unknown): value is string | number { return typeof value === "string" || typeof value === "number"; }

async function getCorreiosToken(settings: CorreiosSettings) {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) return cachedToken.token;
  if (tokenRequest) return tokenRequest;
  tokenRequest = (async () => {
    const authorization = Buffer.from(`${settings.idCorreios}:${settings.apiAccessCode}`).toString("base64");
    const response = await fetch(`${settings.tokenRoot}/v1/autentica/cartaopostagem`, {
      method: "POST",
      headers: { authorization: `Basic ${authorization}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ numero: settings.postingCard, ...(settings.contract ? { contrato: settings.contract } : {}), ...(settings.dr ? { dr: Number(settings.dr) } : {}) }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new ShippingUnavailableError("Os Correios recusaram a autenticação. Confira a chave de acesso, cartão e permissões do contrato.");
    const body = await response.json() as CorreiosTokenResponse;
    if (typeof body.token !== "string" || typeof body.expiraEm !== "string") throw new ShippingUnavailableError("A resposta de autenticação dos Correios está incompleta.");
    const expiresAt = Date.parse(body.expiraEm);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new ShippingUnavailableError("Os Correios retornaram um token inválido ou expirado.");
    cachedToken = { token: body.token, expiresAt };
    return body.token;
  })();
  try { return await tokenRequest; }
  finally { tokenRequest = null; }
}

async function fetchJson(url: URL, token: string) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Correios HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid Correios response");
  return body as JsonRecord;
}

export async function getCorreiosQuotes(postalCode: string, lines: ShippingLine[], originPostalCode?: string): Promise<CorreiosOption[]> {
  const settings = getSettings(originPostalCode);
  const destination = cleanPostalCode(postalCode);
  if (!/^\d{8}$/.test(destination)) throw new ShippingUnavailableError("Informe um CEP válido para consultar os Correios.");
  if (!lines.length || lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10)) throw new ShippingUnavailableError("Não foi possível calcular o pacote da sacola.");
  const uniqueIds = [...new Set(lines.map((line) => line.variantId))];
  if (uniqueIds.length !== lines.length) throw new ShippingUnavailableError("A sacola contém tamanhos repetidos. Atualize os itens e tente novamente.");
  const variants = await getDb().productVariant.findMany({
    where: { id: { in: uniqueIds }, active: true, product: { active: true, demo: false } },
    select: { id: true, product: { select: { weightGrams: true, lengthCm: true, widthCm: true, heightCm: true } } },
  });
  if (variants.length !== uniqueIds.length) throw new ShippingUnavailableError("Uma peça da sacola não está disponível para entrega.");
  const byId = new Map(variants.map((variant) => [variant.id, variant.product]));
  const parcelLines = lines.map((line) => ({ product: byId.get(line.variantId)!, quantity: line.quantity }));
  const parcel = combinePackageDimensions(parcelLines);
  if (!parcel) throw new ShippingUnavailableError("Cadastre peso e dimensões válidos para cada embalagem no painel antes de consultar o frete.");
  const token = await getCorreiosToken(settings);
  const options = await Promise.allSettled(settings.services.map(async (service) => {
    const priceUrl = new URL(`${settings.priceRoot}/v1/nacional/${encodeURIComponent(service.code)}`);
    const priceParams = { cepOrigem: settings.origin, cepDestino: destination, psObjeto: String(parcel.weightGrams), tpObjeto: "2", comprimento: String(parcel.lengthCm), largura: String(parcel.widthCm), altura: String(parcel.heightCm), ...(settings.contract ? { nuContrato: settings.contract } : {}), ...(settings.dr ? { nuDR: settings.dr } : {}) };
    for (const [key, value] of Object.entries(priceParams)) priceUrl.searchParams.set(key, value);
    const timeUrl = new URL(`${settings.deadlineRoot}/v1/nacional/${encodeURIComponent(service.code)}`);
    timeUrl.searchParams.set("cepOrigem", settings.origin);
    timeUrl.searchParams.set("cepDestino", destination);
    const [price, delivery] = await Promise.all([fetchJson(priceUrl, token), fetchJson(timeUrl, token)]);
    const shippingCents = parseBrazilianAmountToCents(price.pcFinal);
    const deliveryDays = hasValue(delivery.prazoEntrega) ? Number(delivery.prazoEntrega) : NaN;
    if (shippingCents === null || !Number.isSafeInteger(shippingCents) || !Number.isInteger(deliveryDays) || deliveryDays < 0) throw new Error("Missing Correios quote fields");
    return { code: service.code, name: service.name, shippingCents, deliveryDays };
  }));
  const quotes = options.flatMap((option) => option.status === "fulfilled" ? [option.value] : []);
  if (!quotes.length) throw new ShippingUnavailableError("Os Correios não conseguiram cotar esta rota e embalagem agora. Confira os serviços habilitados e tente novamente.");
  return quotes;
}

