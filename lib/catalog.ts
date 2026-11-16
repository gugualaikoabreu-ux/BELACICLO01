import type { Product } from "@/lib/products";
import { getDb } from "@/lib/db";
import { productPreparations } from "@/lib/product-preparations";
import { effectiveUnitPrice } from "@/lib/pricing";
import { publicAvailableVariants } from "@/lib/public-stock";

function mapProduct(row: {
  id: string; slug: string; name: string; department: "FEMININA" | "INFANTIL"; description: string; category: string; price: number; promotionalPrice: number | null;
  demo: boolean; images: { url: string; alt: string; position: number }[];
  variants: { id: string; size: string | null; color: string | null; stock: number; reserved: number; active: boolean }[];
  related: { relatedId: string }[];
}): Product {
  const palette: Record<string, string> = { Terracota: "#b27c69", Areia: "#c7b9a4", Oliva: "#5d6158", Marfim: "#eee6da", Sálvia: "#84918b", Palha: "#e2d7c7", Telha: "#a75d47", Café: "#4c4b44" };
  const colorName = row.variants.find((variant) => variant.color)?.color ?? "Natural";
  return {
    id: row.id, slug: row.slug, name: row.name, department: row.department, category: row.category,
    price: effectiveUnitPrice(row.price, row.promotionalPrice),
    regularPrice: row.price,
    color: palette[colorName] ?? (colorName.startsWith("#") ? colorName : "#c7b9a4"), colorName,
    note: row.description,
    sizes: [...new Set(row.variants.filter((variant) => variant.active && variant.stock > variant.reserved).map((variant) => variant.size).filter((size): size is string => Boolean(size)))],
    variants: publicAvailableVariants(row.variants),
    related: row.related.map((item) => item.relatedId), isDemo: row.demo,
    imageUrl: row.images.sort((a, b) => a.position - b.position)[0]?.url,
    imageAlt: row.images.sort((a, b) => a.position - b.position)[0]?.alt,
    images: row.images.sort((a, b) => a.position - b.position).map((image) => ({ url: image.url, alt: image.alt }))
  };
}

export async function getCatalogProducts(): Promise<Product[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const rows = await getDb().product.findMany({ where: { active: true, demo: false, images: { some: {} }, variants: { some: { active: true, stock: { gt: 0 } } } }, include: { images: true, variants: { where: { active: true } }, related: true }, orderBy: { createdAt: "desc" } });
    return rows.map(mapProduct).filter((product) => product.price > 0 && product.sizes.length > 0);
  } catch { return []; }
}

export async function getCatalogProduct(slug: string): Promise<Product | undefined> {
  if (!process.env.DATABASE_URL) return undefined;
  try {
    const row = await getDb().product.findFirst({ where: { slug, active: true, demo: false, images: { some: {} }, variants: { some: { active: true, stock: { gt: 0 } } } }, include: { images: true, variants: { where: { active: true } }, related: true } });
    if (!row) return undefined;
    const product = mapProduct(row);
    return product.price > 0 && product.sizes.length > 0 ? product : undefined;
  } catch { return undefined; }
}

export async function getProductPreparations(): Promise<Product[]> {
  if (!process.env.DATABASE_URL) return productPreparations;
  try {
    const rows = await getDb().product.findMany({
      where: { slug: { in: productPreparations.map((product) => product.slug) }, active: false, demo: false },
      include: { images: { orderBy: { position: "asc" } }, variants: true, related: true },
      orderBy: { createdAt: "asc" },
    });
    const fromDatabase = rows.map((row) => {
      const product = mapProduct(row);
      return {
        ...product,
        sizes: [...new Set(row.variants.filter((variant) => variant.active && variant.size).map((variant) => variant.size as string))],
        variants: [],
        colorName: "Disponibilidade não confirmada",
        isPreparation: true,
      };
    });
    return [...fromDatabase, ...productPreparations.filter((draft) => !fromDatabase.some((product) => product.slug === draft.slug))];
  } catch { return productPreparations; }
}
