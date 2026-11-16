import { z } from "zod";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin";
import { enqueueOrderEmail } from "@/lib/order-notifications";
import { releaseOrderReservations } from "@/lib/stock-reservations";
import { releaseCouponForOrder } from "@/lib/coupons";
import { buildOrderEventNote, canTransitionOrderStatus, describeTrackingChanges } from "@/lib/order-state";
import { recordOrderEvent } from "@/lib/order-events";

const updateSchema = z.object({ status: z.enum(["PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(), trackingCode: z.string().trim().max(80).optional(), trackingUrl: z.string().url().max(500).refine((value) => new URL(value).protocol === "https:", "O link de rastreamento precisa usar HTTPS.").optional(), note: z.string().trim().max(1000).optional() }).refine((value) => value.status !== undefined || value.trackingCode !== undefined || value.trackingUrl !== undefined || Boolean(value.note));
const unpaidManualStatuses = ["PENDING", "PROOF_RECEIVED", "UNIDENTIFIED"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  const actor = await getCurrentUser();
  if (!actor?.id) return Response.json({ message: "Sessão administrativa inválida." }, { status: 401 });
  const { id } = await params; const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ message: "Dados inválidos." }, { status: 400 });
  const { note, ...fields } = parsed.data;
  try {
    const order = await getDb().$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${id} FOR UPDATE`;
      if (!locked.length) throw new Error("Pedido não encontrado.");
      const current = await tx.order.findUniqueOrThrow({
        where: { id },
        select: {
          id: true, number: true, customerName: true, customerEmail: true, total: true,
          status: true, paymentStatus: true, trackingCode: true, trackingUrl: true,
          payments: { select: { id: true, provider: true, amount: true } },
        },
      });
      if (fields.status && !canTransitionOrderStatus(current.status, fields.status)) throw new Error("Esta mudança de status não é permitida.");
      if (["PREPARING", "SHIPPED", "DELIVERED"].includes(fields.status ?? "") && current.paymentStatus !== "APPROVED") throw new Error("Pagamento não aprovado.");
      if (fields.status === "SHIPPED" && !fields.trackingCode && !current.trackingCode) throw new Error("Código de rastreamento obrigatório.");
      const cancelling = fields.status === "CANCELLED" && current.status !== "CANCELLED";
      if (cancelling && current.paymentStatus === "APPROVED") throw new Error("Pedidos pagos exigem um fluxo de estorno antes do cancelamento.");
      if (cancelling && !unpaidManualStatuses.includes(current.paymentStatus as (typeof unpaidManualStatuses)[number])) throw new Error("Somente pedidos sem pagamento confirmado podem ser cancelados por este fluxo.");

      if (cancelling && unpaidManualStatuses.includes(current.paymentStatus as (typeof unpaidManualStatuses)[number])) {
        await releaseOrderReservations(tx, id);
        await releaseCouponForOrder(tx, id);
        const latest = await tx.order.findUniqueOrThrow({
          where: { id },
          select: {
            id: true, number: true, customerName: true, customerEmail: true, total: true,
            status: true, paymentStatus: true, trackingCode: true, trackingUrl: true,
            payments: { select: { id: true, provider: true, amount: true } },
          },
        });
        if (latest.paymentStatus === "APPROVED") throw new Error("O pagamento acabou de ser confirmado. Este pedido não pode ser cancelado sem um fluxo de estorno.");
        if (!unpaidManualStatuses.includes(latest.paymentStatus as (typeof unpaidManualStatuses)[number])) throw new Error("O pedido já não está aguardando pagamento.");
        const changed = await tx.order.updateMany({ where: { id, status: { not: "CANCELLED" } }, data: { status: "CANCELLED", paymentStatus: "EXPIRED" } });
        if (!changed.count) throw new Error("O pedido foi atualizado em outra operação. Atualize e tente novamente.");
        await tx.$executeRaw`
          UPDATE "payments"
          SET "paymentStatus" = 'EXPIRED'::"PaymentStatus", "updatedAt" = NOW()
          WHERE "orderId" = ${id} AND "paymentStatus"::text IN ('PENDING', 'PROOF_RECEIVED', 'UNIDENTIFIED')
        `;
        const payment = latest.payments[0];
        if (payment) await tx.paymentEvent.create({ data: { provider: payment.provider, providerEventId: `manual-cancel:${payment.id}`, paymentId: payment.id, orderId: id, amount: payment.amount, eventType: "CANCELLED", eventData: { actorId: actor.id, actorEmail: actor.email, note: note ?? "" }, processedAt: new Date() } });
        await recordOrderEvent(tx, { orderId: id, status: "CANCELLED", note: note ?? "Pedido cancelado pelo administrador; reservas liberadas.", actorId: actor.id, actorEmail: actor.email });
        await enqueueOrderEmail(tx, { ...latest, ...current }, "cancelled");
        return { id, status: "CANCELLED", paymentStatus: "EXPIRED" };
      }

      const trackingChanges = describeTrackingChanges(current, fields);
      const statusChanged = fields.status !== undefined && fields.status !== current.status;
      const data: typeof fields = {};
      if (statusChanged && fields.status) data.status = fields.status;
      if (fields.trackingCode !== undefined && fields.trackingCode !== current.trackingCode) data.trackingCode = fields.trackingCode;
      if (fields.trackingUrl !== undefined && fields.trackingUrl !== current.trackingUrl) data.trackingUrl = fields.trackingUrl;
      const updated = Object.keys(data).length > 0
        ? await tx.order.update({ where: { id }, data, select: { id: true, status: true, paymentStatus: true, trackingCode: true, trackingUrl: true } })
        : current;
      const eventNote = buildOrderEventNote(note, trackingChanges);
      if (statusChanged || eventNote) await recordOrderEvent(tx, { orderId: id, status: fields.status ?? current.status, note: eventNote, actorId: actor.id, actorEmail: actor.email });
      if (statusChanged && fields.status === "PREPARING") await enqueueOrderEmail(tx, { ...current, ...updated }, "preparing");
      if (statusChanged && (fields.status === "SHIPPED" || fields.status === "DELIVERED")) {
        const shippingStatus = fields.status;
        const [shipmentStorage] = await tx.$queryRaw<Array<{ writable: boolean }>>`
          SELECT CASE
            WHEN to_regclass('public.shipments') IS NULL THEN false
            ELSE has_table_privilege(current_user, 'public.shipments', 'SELECT')
              AND has_table_privilege(current_user, 'public.shipments', 'INSERT')
              AND has_table_privilege(current_user, 'public.shipments', 'UPDATE')
          END AS "writable"
        `;
        if (shipmentStorage?.writable) {
          const existing = await tx.shipment.findFirst({ where: { orderId: id }, orderBy: { createdAt: "desc" } });
          const shipmentData = { carrier: "CORREIOS", trackingCode: fields.trackingCode ?? current.trackingCode, shippingStatus, ...(shippingStatus === "SHIPPED" ? { shippedAt: new Date() } : { deliveredAt: new Date() }) };
          if (existing) await tx.shipment.update({ where: { id: existing.id }, data: shipmentData });
          else await tx.shipment.create({ data: { orderId: id, ...shipmentData } });
        }
        await enqueueOrderEmail(tx, { ...current, ...updated }, shippingStatus === "SHIPPED" ? "shipped" : "delivered");
      }
      return updated;
    });
    return Response.json({ order });
  } catch (error) {
    const safeMessages = new Set(["Pedido não encontrado.", "Esta mudança de status não é permitida.", "Pagamento não aprovado.", "Código de rastreamento obrigatório.", "Pedidos pagos exigem um fluxo de estorno antes do cancelamento.", "Somente pedidos sem pagamento confirmado podem ser cancelados por este fluxo.", "O pagamento acabou de ser confirmado. Este pedido não pode ser cancelado sem um fluxo de estorno.", "O pedido já não está aguardando pagamento.", "O pedido foi atualizado em outra operação. Atualize e tente novamente."]);
    const message = error instanceof Error && safeMessages.has(error.message) ? error.message : "Não foi possível atualizar o pedido.";
    return Response.json({ message }, { status: 409 });
  }
}
