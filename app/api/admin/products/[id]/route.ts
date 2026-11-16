import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { categorySlug } from "@/lib/category-slug";
const updateSchema = z.object({ name: z.string().trim().min(2).max(140).optional(), description: z.string().trim().min(5).max(5000).optional(), department: z.enum(["FEMININA", "INFANTIL"]).optional(), category: z.string().trim().min(2).max(80).optional(), priceCents: z.number().int().positive().max(100_000_000).optional(), promotionalPriceCents: z.number().int().positive().nullable().optional(), weightGrams: z.number().int().positive().max(30_000).nullable().optional(), lengthCm: z.number().int().positive().max(100).nullable().optional(), widthCm: z.number().int().positive().max(100).nullable().optional(), heightCm: z.number().int().positive().max(100).nullable().optional(), active: z.boolean().optional(), demo: z.boolean().optional() }).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  if (!await enforceRateLimit("admin-product-update", requestIp(request), 60, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
  const { id } = await params; const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ message: "Dados inválidos." }, { status: 400 });
  const { priceCents, promotionalPriceCents, ...fields } = parsed.data;
  try {
    const db = getDb();
    if (priceCents !== undefined || promotionalPriceCents !== undefined) {
      const currentPrices = await getDb().product.findUnique({ where: { id }, select: { price: true, promotionalPrice: true } });
      if (!currentPrices) return Response.json({ message: "Produto não encontrado." }, { status: 404 });
      const nextRegularPrice = priceCents ?? currentPrices.price;
      const nextPromotionalPrice = promotionalPriceCents === undefined ? currentPrices.promotionalPrice : promotionalPriceCents;
      if (nextPromotionalPrice !== null && nextPromotionalPrice >= nextRegularPrice) return Response.json({ message: "O preço promocional precisa ser menor que o preço oficial." }, { status: 400 });
    }
    if (fields.active === true) {
      const current = await db.product.findUnique({ where: { id }, include: { images: true, variants: true } });
      if (!current) return Response.json({ message: "Produto não encontrado." }, { status: 404 });
      const willBeDemo = fields.demo ?? current.demo;
      const willHavePrice = (priceCents ?? current.price) > 0;
      const missing: string[] = [];
      if (willBeDemo) missing.push("remova o status de demonstração");
      if (!willHavePrice) missing.push("informe o preço oficial");
      if (current.images.length === 0) missing.push("adicione uma foto oficial");
      if (!current.variants.some((variant) => variant.active && Boolean(variant.size?.trim()) && variant.stock > variant.reserved)) missing.push("adicione um tamanho ativo com estoque disponível");
      if (missing.length) return Response.json({ message: `Para ativar, ${missing.join(" e ")}.` }, { status: 400 });
    }
    const product = await db.$transaction(async (tx) => {
      const current = fields.category !== undefined || fields.department !== undefined
        ? await tx.product.findUnique({ where: { id }, select: { category: true, department: true } })
        : null;
      if ((fields.category !== undefined || fields.department !== undefined) && !current) throw new Error("Produto não encontrado.");
      const category = fields.category ?? current?.category;
      const department = fields.department ?? current?.department;
      const categoryRef = category && department
        ? await tx.category.upsert({
          where: { slug: categorySlug(category, department) },
          create: { slug: categorySlug(category, department), name: category, department },
          update: { name: category, department },
        })
        : null;
      return tx.product.update({
        where: { id },
        data: {
          ...fields,
          ...(categoryRef ? { categoryId: categoryRef.id } : {}),
          ...(categoryRef && !categoryRef.active ? { active: false } : {}),
          ...(priceCents === undefined ? {} : { price: priceCents }),
          ...(promotionalPriceCents === undefined ? {} : { promotionalPrice: promotionalPriceCents }),
        },
      });
    });
    return Response.json({ product });
  }
  catch { return Response.json({ message: "Produto não encontrado ou atualização inválida." }, { status: 404 }); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const { id } = await params;
  try { await getDb().product.delete({ where: { id } }); return new Response(null, { status: 204 }); }
  catch { return Response.json({ message: "Não foi possível remover o produto." }, { status: 404 }); }
}
