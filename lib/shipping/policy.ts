export type StoreShippingRates = { fixedShippingCents: number | null; freeShippingThresholdCents: number | null };

export function storeShippingAmount(settings: StoreShippingRates, subtotalCents: number) {
  if (settings.freeShippingThresholdCents !== null && subtotalCents >= settings.freeShippingThresholdCents) {
    return { shippingCents: 0, serviceName: "Frete grátis da loja", source: "free_threshold" as const };
  }
  if (settings.fixedShippingCents !== null) {
    return { shippingCents: settings.fixedShippingCents, serviceName: "Entrega definida pela loja", source: "fixed_store_rate" as const };
  }
  return null;
}
