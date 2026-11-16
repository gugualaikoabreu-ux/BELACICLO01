export function normalizeVariantKey(size: string, color?: string | null) {
  return `${size.trim().toLocaleLowerCase("pt-BR")}\u0000${(color ?? "").trim().toLocaleLowerCase("pt-BR")}`;
}
