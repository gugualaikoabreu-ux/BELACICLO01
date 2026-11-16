export class ShippingUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "ShippingUnavailableError"; }
}

export function hasConfiguredShippingRate() {
  const raw = process.env.SHIPPING_FIXED_CENTS;
  return raw !== undefined && raw.trim() !== "";
}

export function getConfiguredShippingCents() {
  const raw = process.env.SHIPPING_FIXED_CENTS;
  if (!hasConfiguredShippingRate()) throw new ShippingUnavailableError("O frete ainda precisa ser definido pela BelaCiclo ou integrado aos Correios.");
  const amount = Number(raw);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new ShippingUnavailableError("O valor de frete configurado é inválido.");
  return amount;
}
