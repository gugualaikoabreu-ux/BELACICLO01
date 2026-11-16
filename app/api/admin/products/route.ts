import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { normalizeVariantKey } from "@/lib/product-variant-key";
import { categorySlug } from "@/lib/category-slug";
import { productImageUrlSchema } from "@/lib/product-image-url";

const createSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().min(5).max(5000),
  department: z.enum(["FEMININA", "INFANTIL"]),
  category: z.string().trim().min(2).max(80),
  priceCents: z.number().int().positive().max(100_000_000),
  promotionalPriceCents: z.number().int().positive().nullable().optional(),
  weightGrams: z.number().int().positive().max(30_000).nullable().optional(),
  lengthCm: z.number().int().positive().max(100).nullable().optional(),
  widthCm: z.number().int().positive().max(100).nullable().optional(),
  heightCm: z.number().int().positive().max(100).nullable().optional(),
  images: z.array(z.object({ url: productImageUrlSchema, alt: z.string().trim().min(3).max(250), position: z.number().int().nonnegative() })).max(12).default([]),
  variants: z.array(z.object({ size: z.string().trim().min(1).max(30), color: z.string().trim().max(60).optional(), stock: z.number().int().nonnegative() })).max(100).default([]).superRefine((variants, context) => {
    const seen = new Set<string>();
    variants.forEach((variant, index) => {
    const key = normalizeVariantKey(variant.size, variant.color);
      if (seen.has(key)) context.addIssue({ code: "custom", path: [index], message: "Tamanho e cor duplicados." });
      seen.add(key);
    });
  }),
  relatedIds: z.array(z.string().min(1)).max(20).default([])
});

export async function GET(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  try {
    const products = await getDb().product.findMany({ orderBy: { updatedAt: "desc" }, include: { variants: { include: { movements: { orderBy: { createdAt: "desc" }, take: 5 } } }, images: { orderBy: { position: "asc" } }, related: true } });
    return Response.json({ products });
  } catch { return Response.json({ message: "Não foi possível consultar os produtos." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  try {
    if (!await enforceRateLimit("admin-products", requestIp(request), 60, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ message: "Dados de produto inválidos.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { priceCents, promotionalPriceCents, images, variants, relatedIds, ...data } = parsed.data;
    if (promotionalPriceCents != null && promotionalPriceCents >= priceCents) return Response.json({ message: "O preço promocional precisa ser menor que o preço oficial." }, { status: 400 });
    const db = getDb();
    const product = await db.$transaction(async (tx) => {
      const categoryRef = await tx.category.upsert({
        where: { slug: categorySlug(data.category, data.department) },
        create: { slug: categorySlug(data.category, data.department), name: data.category, department: data.department },
        update: { name: data.category, department: data.department },
      });
      const created = await tx.product.create({ data: {
        ...data,
        categoryId: categoryRef.id,
        active: false,
        demo: false,
        price: priceCents,
        promotionalPrice: promotionalPriceCents ?? null,
        images: { create: images },
        variants: { create: variants.map((variant) => ({ ...variant, color: variant.color?.trim() || null })) },
        related: { create: relatedIds.map((relatedId) => ({ relatedId })) }
      }, include: { variants: true } });
      for (const variant of created.variants) {
        if (variant.stock > 0) await tx.stockMovement.create({ data: { variantId: variant.id, delta: variant.stock, reason: "Estoque inicial no cadastro do produto" } });
      }
      return created;
    });
    return Response.json({ product }, { status: 201 });
  } catch { return Response.json({ message: "Não foi possível criar o produto. Verifique se o slug e as relações são únicos e válidos." }, { status: 400 }); }
}
