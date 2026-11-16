export function effectiveUnitPrice(priceCents: number, promotionalPriceCents: number | null | undefined) {
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0) throw new Error("Preço oficial inválido.");
  return typeof promotionalPriceCents === "number" && Number.isSafeInteger(promotionalPriceCents) && promotionalPriceCents > 0 && promotionalPriceCents < priceCents
    ? promotionalPriceCents
    : priceCents;
}
