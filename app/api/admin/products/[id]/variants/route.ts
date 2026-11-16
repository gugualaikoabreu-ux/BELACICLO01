import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { normalizeVariantKey } from "@/lib/product-variant-key";

const schema = z.object({ size: z.string().trim().min(1).max(30), color: z.string().trim().max(60).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  if (!await enforceRateLimit("admin-product-variants", requestIp(request), 60, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Informe um tamanho válido." }, { status: 400 });
  const { id } = await params;
  try {
    const db = getDb();
    const result = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "products" WHERE "id" = ${id} FOR UPDATE`;
      if (!locked.length) return { kind: "missing" as const };
      const existingVariants = await tx.productVariant.findMany({ where: { productId: id }, select: { size: true, color: true } });
      const variantKey = normalizeVariantKey(parsed.data.size, parsed.data.color);
      if (existingVariants.some((variant) => normalizeVariantKey(variant.size ?? "", variant.color) === variantKey)) return { kind: "duplicate" as const };
      const variant = await tx.productVariant.create({ data: { productId: id, size: parsed.data.size, color: parsed.data.color || null, stock: 0, reserved: 0, active: true } });
      return { kind: "created" as const, variant };
    });
    if (result.kind === "missing") return Response.json({ message: "Produto não encontrado." }, { status: 404 });
    if (result.kind === "duplicate") return Response.json({ message: "Este tamanho e cor já existem no produto." }, { status: 409 });
    return Response.json({ variant: result.variant }, { status: 201 });
  } catch { return Response.json({ message: "Não foi possível adicionar o tamanho." }, { status: 400 }); }
}
