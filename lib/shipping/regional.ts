export const CURITIBA_METROPOLITAN_MUNICIPALITIES = [
  "Adrianópolis",
  "Agudos do Sul",
  "Almirante Tamandaré",
  "Araucária",
  "Balsa Nova",
  "Bocaiúva do Sul",
  "Campina Grande do Sul",
  "Campo do Tenente",
  "Campo Largo",
  "Campo Magro",
  "Cerro Azul",
  "Colombo",
  "Contenda",
  "Curitiba",
  "Doutor Ulysses",
  "Fazenda Rio Grande",
  "Itaperuçu",
  "Lapa",
  "Mandirituba",
  "Piên",
  "Pinhais",
  "Piraquara",
  "Quatro Barras",
  "Quitandinha",
  "Rio Branco do Sul",
  "Rio Negro",
  "São José dos Pinhais",
  "Tijucas do Sul",
  "Tunas do Paraná",
] as const;

function normalizeMunicipality(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

export function municipalitiesMatch(left: string, right: string) {
  return normalizeMunicipality(left) === normalizeMunicipality(right);
}

const rmcMunicipalityKeys = new Set(CURITIBA_METROPOLITAN_MUNICIPALITIES.map(normalizeMunicipality));

export type RegionalShippingZone = "CURITIBA_METRO" | "PARANA_INTERIOR" | "OTHER_STATES";

export function classifyRegionalDestination(city: string, state: string): RegionalShippingZone | null {
  const normalizedState = state.trim().toLocaleUpperCase("pt-BR");
  const normalizedCity = normalizeMunicipality(city);
  if (!/^[A-Z]{2}$/.test(normalizedState) || !normalizedCity) return null;
  if (normalizedState !== "PR") return "OTHER_STATES";
  return rmcMunicipalityKeys.has(normalizedCity) ? "CURITIBA_METRO" : "PARANA_INTERIOR";
}

export function estimateDeliveryRange(minDays: number | null, maxDays: number | null) {
  if (!Number.isInteger(minDays) || !Number.isInteger(maxDays) || minDays! < 1 || maxDays! < minDays! || maxDays! > 365) {
    return { minDays: null, maxDays: null };
  }
  return { minDays, maxDays };
}
