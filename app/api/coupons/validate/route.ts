import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/supabase/server";
import { effectiveUnitPrice } from "@/lib/pricing";
import { enforceRateLimit, requestIp } from "@/lib/rate-limit";
import { CouponUnavailableError, lockAndValidateCoupon } from "@/lib/coupons";
import { isSameOriginMutationRequest } from "@/lib/security/same-origin";

const schema = z.object({
  code: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9-]+$/),
  items: z.array(z.object({ variantId: z.string().min(1).max(180), quantity: z.number().int().min(1).max(10) })).min(1).max(30),
});

export async function POST(request: Request) {
  if (!isSameOriginMutationRequest(request)) return Response.json({ message: "Origem da requisição inválida." }, { status: 403 });
  if (!process.env.DATABASE_URL) return Response.json({ message: "Banco de dados não configurado." }, { status: 503 });
  if (!await enforceRateLimit("coupon-validation", requestIp(request), 10, 60)) return Response.json({ message: "Muitas tentativas. Aguarde um minuto." }, { status: 429 });
  const user = await getCurrentUser();
  if (!user?.id || !user.email_confirmed_at) return Response.json({ message: "Entre na conta e confirme o e-mail para validar um cupom." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || new Set(parsed.data.items.map((item) => item.variantId)).size !== parsed.data.items.length) {
    return Response.json({ message: "Informe um cupom e uma sacola válidos." }, { status: 400 });
  }
  try {
    const quote = await getDb().$transaction(async (tx) => {
      const ids = parsed.data.items.map((item) => item.variantId);
      const variants = await tx.productVariant.findMany({ where: { id: { in: ids }, active: true }, include: { product: true } });
      if (variants.length !== ids.length) throw new CouponUnavailableError("Uma peça da sacola não está disponível.");
      const byId = new Map(variants.map((variant) => [variant.id, variant]));
      const subtotalCents = parsed.data.items.reduce((subtotal, item) => {
        const variant = byId.get(item.variantId);
        if (!variant || !variant.product.active || variant.product.demo || variant.stock - variant.reserved < item.quantity) throw new CouponUnavailableError("Estoque insuficiente para validar este cupom.");
        return subtotal + effectiveUnitPrice(variant.product.price, variant.product.promotionalPrice) * item.quantity;
      }, 0);
      return lockAndValidateCoupon(tx, { code: parsed.data.code, userId: user.id, subtotalCents });
    }, { isolationLevel: "Serializable" });
    return Response.json({ code: quote.code, subtotalCents: quote.subtotalCents, discountCents: quote.discountCents, discountedSubtotalCents: quote.discountedSubtotalCents });
  } catch (error) {
    if (error instanceof CouponUnavailableError) return Response.json({ message: error.message }, { status: 409 });
    return Response.json({ message: "Não foi possível validar o cupom. Confira a migration do checkout." }, { status: 503 });
  }
}
