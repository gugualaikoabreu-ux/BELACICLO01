export type CepAddressFields = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export type CepLookupResult = CepAddressFields & { postalCode: string };

export type CepLookupFailureKind = "invalid" | "not_found" | "unavailable";

export class CepLookupError extends Error {
  readonly kind: CepLookupFailureKind;

  constructor(kind: CepLookupFailureKind, message: string) {
    super(message);
    this.name = "CepLookupError";
    this.kind = kind;
  }
}

export function normalizeCep(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCep(value: string) {
  const digits = normalizeCep(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function isValidCep(value: string) {
  return /^\d{8}$/.test(value) || /^\d{5}-\d{3}$/.test(value);
}

export async function lookupViaCep(value: string, fetcher: typeof fetch = fetch): Promise<CepLookupResult> {
  const postalCode = normalizeCep(value);
  if (!/^\d{8}$/.test(postalCode)) {
    throw new CepLookupError("invalid", "Informe um CEP com 8 dígitos.");
  }

  let response: Response;
  try {
    response = await fetcher(`https://viacep.com.br/ws/${postalCode}/json/`, {
      cache: "force-cache",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new CepLookupError("unavailable", "Não foi possível consultar o CEP. Confira sua conexão ou preencha o endereço manualmente.");
  }

  if (!response.ok) {
    throw new CepLookupError("unavailable", "O serviço de CEP está indisponível. Preencha o endereço manualmente ou tente novamente.");
  }

  let data: Record<string, unknown>;
  try {
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid ViaCEP response");
    data = parsed as Record<string, unknown>;
  } catch {
    throw new CepLookupError("unavailable", "O serviço de CEP retornou uma resposta inválida. Preencha o endereço manualmente ou tente novamente.");
  }

  if (data.erro === true) {
    throw new CepLookupError("not_found", "CEP não encontrado. Confira os números ou preencha o endereço manualmente.");
  }

  const text = (field: unknown) => typeof field === "string" ? field.trim() : "";
  const address = {
    postalCode,
    street: text(data.logradouro),
    neighborhood: text(data.bairro),
    city: text(data.localidade),
    state: text(data.uf).toUpperCase(),
  };
  if (data.erro === true || (!address.street && !address.neighborhood && !address.city && !address.state)) {
    throw new CepLookupError("not_found", "CEP não encontrado. Confira os números ou preencha o endereço manualmente.");
  }
  return address;
}

/** Merge only the lookup-provided fields so number, complement, reference and manual fields survive. */
export function mergeCepAddress<T extends CepAddressFields>(current: T, result: CepLookupResult): T {
  return { ...current, street: result.street, neighborhood: result.neighborhood, city: result.city, state: result.state };
}

/** Clear address fields when a customer changes a previously complete CEP, retaining delivery details. */
export function clearCepAddress<T extends CepAddressFields>(current: T): T {
  return { ...current, street: "", neighborhood: "", city: "", state: "" };
}

export function updateCepAddressField<T extends CepAddressFields>(current: T, field: keyof CepAddressFields, value: string): T {
  return { ...current, [field]: field === "state" ? value.toUpperCase().slice(0, 2) : value };
}
