export function calculateCheckoutTotal(subtotalCents: number, discountCents: number, shippingCents: number) {
  const totalCents = subtotalCents - discountCents + shippingCents;
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents <= 0
    || !Number.isSafeInteger(discountCents) || discountCents < 0 || discountCents > subtotalCents
    || !Number.isSafeInteger(shippingCents) || shippingCents < 0
    || !Number.isSafeInteger(totalCents) || totalCents <= 0) return null;
  return totalCents;
}
