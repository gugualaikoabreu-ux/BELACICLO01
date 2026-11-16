export const storeConfig = {
  name: "BelaCiclo",
  segment: "Moda feminina e infantil",
  email: process.env.NEXT_PUBLIC_STORE_EMAIL?.trim() || "Belaciclo.cwb@gmail.com",
  legalName: process.env.STORE_LEGAL_NAME ?? "",
  cnpj: process.env.STORE_CNPJ ?? "",
  address: process.env.STORE_ADDRESS ?? "",
  currency: "BRL"
} as const;

export const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueInCents / 100);
