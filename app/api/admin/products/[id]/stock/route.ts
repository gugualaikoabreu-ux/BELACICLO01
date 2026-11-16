import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";

const schema = z.object({ variantId: z.string().min(1), delta: z.number().int().min(-10000).max(10000).refine((value) => value !== 0), reason: z.string().trim().min(2).max(200).default("Ajuste de estoque pelo painel") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  if (!await enforceRateLimit("admin-stock", requestIp(request), 90, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Informe um ajuste de estoque válido." }, { status: 400 });
  const { id } = await params;
  const actor = await getCurrentUser();
  try {
    const db = getDb();
    const result = await db.$transaction(async (tx) => {
      const changed = await tx.$executeRaw`UPDATE "product_variants" SET "stock" = "stock" + ${parsed.data.delta}, "updatedAt" = NOW() WHERE "id" = ${parsed.data.variantId} AND "productId" = ${id} AND "stock" + ${parsed.data.delta} >= "reserved" AND "stock" + ${parsed.data.delta} >= 0`;
      if (changed !== 1) return null;
      const variant = await tx.productVariant.findUnique({ where: { id: parsed.data.variantId } });
      if (!variant) return null;
      await tx.stockMovement.create({ data: { variantId: variant.id, delta: parsed.data.delta, reason: parsed.data.reason, actorId: actor?.id ?? null } });
      return variant;
    });
    if (!result) return Response.json({ message: "Ajuste recusado: variação inexistente ou o estoque não pode ficar abaixo das unidades reservadas." }, { status: 409 });
    return Response.json({ variant: result });
  } catch { return Response.json({ message: "Não foi possível ajustar o estoque." }, { status: 400 }); }
}
