import { getCurrentUser } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { releaseCouponForOrder } from "@/lib/coupons";
import { isSameOriginMutationRequest } from "@/lib/security/same-origin";
import { releaseOrderReservations } from "@/lib/stock-reservations";
import { recordOrderEvent } from "@/lib/order-events";

const safeMessages = new Set([
  "Pedido não encontrado.",
  "Este pedido já foi atualizado. Atualize a página e tente novamente.",
  "Este pedido não pode ser cancelado por aqui. Se você já pagou ou o pedido está em processamento, fale com a BelaCiclo.",
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutationRequest(request)) return Response.json({ message: "Origem da requisição inválida." }, { status: 403 });
  if (!process.env.DATABASE_URL) return Response.json({ message: "O cancelamento está indisponível neste momento." }, { status: 503 });

  const user = await getCurrentUser();
  if (!user?.id) return Response.json({ message: "Entre na sua conta para cancelar o pedido." }, { status: 401 });
  const { id } = await params;
  let stage = "lock_order";

  try {
    const result = await getDb().$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${id} AND "userId" = ${user.id} FOR UPDATE`;
      if (!locked.length) throw new Error("Pedido não encontrado.");

      const order = await tx.order.findFirst({
        where: { id, userId: user.id },
        select: { id: true, status: true, paymentStatus: true },
      });
      if (!order) throw new Error("Pedido não encontrado.");
      if (order.status === "CANCELLED") return { alreadyCancelled: true };
      if (order.status !== "RECEIVED" || order.paymentStatus !== "PENDING") {
        throw new Error("Este pedido não pode ser cancelado por aqui. Se você já pagou ou o pedido está em processamento, fale com a BelaCiclo.");
      }

      stage = "cancel_order";
      const changed = await tx.order.updateMany({
        where: { id, userId: user.id, status: "RECEIVED", paymentStatus: "PENDING" },
        data: { status: "CANCELLED", paymentStatus: "EXPIRED" },
      });
      if (!changed.count) throw new Error("Este pedido já foi atualizado. Atualize a página e tente novamente.");

      stage = "expire_payment";
      await tx.payment.updateMany({ where: { orderId: id, paymentStatus: "PENDING" }, data: { paymentStatus: "EXPIRED" } });
      stage = "release_stock";
      await releaseOrderReservations(tx, id);
      stage = "release_coupon";
      await releaseCouponForOrder(tx, id);
      stage = "record_order_event";
      await recordOrderEvent(tx, { orderId: id, status: "CANCELLED", note: "Pedido cancelado pelo cliente; unidades reservadas liberadas." });
      return { alreadyCancelled: false };
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error && safeMessages.has(error.message) ? error.message : "Não foi possível cancelar o pedido agora. Tente novamente ou fale com a BelaCiclo.";
    const status = message === "Pedido não encontrado." ? 404 : safeMessages.has(message) ? 409 : 500;
    if (status === 500) {
      const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : null;
      console.error("[customer-order-cancel] failed", { stage, errorName: error instanceof Error ? error.name : "UnknownError", errorCode });
    }
    return Response.json({ message }, { status });
  }
}
