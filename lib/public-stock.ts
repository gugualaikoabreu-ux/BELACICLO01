type InventoryVariant = { id: string; size: string | null; color: string | null; stock: number; reserved: number; active: boolean };

export function publicAvailableVariants(variants: InventoryVariant[]) {
  return variants
    .filter((variant) => variant.active && variant.stock > variant.reserved)
    .map(({ id, size, color }) => ({ id, size, color, available: true as const }));
}
