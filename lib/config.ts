export const storeConfig = {
  name: "BelaCiclo",
  segment: "Moda feminina e infantil",
  email: process.env.NEXT_PUBLIC_STORE_EMAIL?.trim() || "Belaciclo.cwb@gmail.com",
  instagramUrl: "https://www.instagram.com/belaciclo/",
  whatsappUrl: "https://wa.me/5541995385660?text=Ol%C3%A1%2C%20BelaCiclo!%20Vim%20pelo%20site.",
  legalName: process.env.STORE_LEGAL_NAME ?? "",
  cnpj: process.env.STORE_CNPJ ?? "",
  address: process.env.STORE_ADDRESS ?? "",
  currency: "BRL"
} as const;

export const formatCurrency = (valueInCents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueInCents / 100);
