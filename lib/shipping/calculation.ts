export type ProductPackage = { weightGrams: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null };
export type ParcelLine = { product: ProductPackage; quantity: number };
export type ParcelDimensions = { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number };

/** Package policy currently assumes units are folded end-to-end in one parcel. */
export function combinePackageDimensions(lines: ParcelLine[]): ParcelDimensions | null {
  const validMeasurement = (value: number | null, max: number) => typeof value === "number" && Number.isInteger(value) && value > 0 && value <= max;
  const validProductPackage = ({ weightGrams, lengthCm, widthCm, heightCm }: ProductPackage) =>
    validMeasurement(weightGrams, 30_000)
    && validMeasurement(lengthCm, 100)
    && validMeasurement(widthCm, 100)
    && validMeasurement(heightCm, 100);
  if (!lines.length || lines.some(({ quantity, product }) => !Number.isInteger(quantity) || quantity < 1 || !validProductPackage(product))) return null;
  const combined = lines.reduce<ParcelDimensions>((parcel, { quantity, product }) => ({
    weightGrams: parcel.weightGrams + product.weightGrams! * quantity,
    lengthCm: parcel.lengthCm + product.lengthCm! * quantity,
    widthCm: Math.max(parcel.widthCm, product.widthCm!),
    heightCm: Math.max(parcel.heightCm, product.heightCm!),
  }), { weightGrams: 0, lengthCm: 0, widthCm: 0, heightCm: 0 });
  return Number.isSafeInteger(combined.weightGrams) && combined.weightGrams > 0 && combined.weightGrams <= 30_000
    && [combined.lengthCm, combined.widthCm, combined.heightCm].every((value) => Number.isSafeInteger(value) && value > 0 && value <= 100)
    ? combined
    : null;
}

export function parseBrazilianAmountToCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value >= 0 ? Math.round(value * 100) : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}
