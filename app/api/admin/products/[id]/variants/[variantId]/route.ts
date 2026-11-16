import { z } from "zod";
import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";

const schema = z.object({ active: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  if (!await enforceRateLimit("admin-product-variants", requestIp(request), 60, 60)) return Response.json({ message: "Limite temporário excedido." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Dados inválidos." }, { status: 400 });
  const { id, variantId } = await params;
  try {
    const db = getDb();
    const variant = await db.productVariant.findFirst({ where: { id: variantId, productId: id } });
    if (!variant) return Response.json({ message: "Variação não encontrada." }, { status: 404 });
    if (!parsed.data.active && variant.reserved > 0) return Response.json({ message: "Libere os pedidos reservados antes de desativar esta variação." }, { status: 409 });
    const updated = await db.productVariant.update({ where: { id: variant.id }, data: { active: parsed.data.active } });
    return Response.json({ variant: updated });
  } catch { return Response.json({ message: "Não foi possível atualizar a variação." }, { status: 400 }); }
}
