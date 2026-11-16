import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { enqueueOrderEmail } from "./order-notifications.ts";
import { redeemCouponForOrder } from "./coupons.ts";
import { recordOrderEvent } from "./order-events.ts";

type Tx = Prisma.TransactionClient;
export type ManualPaymentReviewStatus = "PROOF_RECEIVED" | "UNIDENTIFIED";

const reviewablePaymentStatuses = ["PENDING", "PROOF_RECEIVED", "UNIDENTIFIED"] as const;

async function lockOrder(tx: Tx, orderId: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
  if (!locked.length) throw new Error("Pedido não encontrado.");
}

export async function recordManualPaymentReviewStatus(
  tx: Tx,
  input: { orderId: string; status: ManualPaymentReviewStatus; adminUserId: string; adminEmail: string; note: string },
  now = new Date(),
) {
  await lockOrder(tx, input.orderId);
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true, number: true, customerName: true, customerEmail: true, total: true, trackingCode: true, trackingUrl: true, status: true, paymentStatus: true,
      payments: { select: { id: true, provider: true, amount: true, paymentStatus: true, expiresAt: true } },
    },
  });
  if (!order) throw new Error("Pedido não encontrado.");
  const payment = order.payments[0];
  if (!payment || payment.provider !== "MANUAL_PIX_STATIC") throw new Error("Este pedido não usa PIX manual.");
  if (order.status === "CANCELLED" || !reviewablePaymentStatuses.includes(order.paymentStatus as (typeof reviewablePaymentStatuses)[number])) {
    throw new Error("Este pedido não pode receber atualização de conferência.");
  }
  const eventType = input.status === "PROOF_RECEIVED" ? "MANUAL_PROOF_RECEIVED" : "MANUAL_PAYMENT_UNIDENTIFIED";
  const previousReview = await tx.paymentEvent.findFirst({
    where: { paymentId: payment.id, eventType: { in: ["MANUAL_PROOF_RECEIVED", "MANUAL_PAYMENT_UNIDENTIFIED"] } },
    orderBy: { createdAt: "desc" },
    select: { eventType: true },
  });
  if (previousReview?.eventType === eventType) return { order, alreadyUpdated: true };
  if (!reviewablePaymentStatuses.includes(payment.paymentStatus as (typeof reviewablePaymentStatuses)[number])) {
    throw new Error("Este pagamento não pode receber atualização de conferência.");
  }
  if (payment.expiresAt && payment.expiresAt <= now) throw new Error("O prazo da reserva expirou; não atualize este pagamento.");
  if (input.status === "UNIDENTIFIED" && input.note.trim().length < 3) throw new Error("Informe o motivo pelo qual o pagamento não foi identificado.");

  const label = input.status === "PROOF_RECEIVED" ? "Comprovante PIX recebido; aguardando conferência bancária." : "Pagamento PIX não identificado na conta recebedora.";
  await tx.paymentEvent.create({ data: {
    provider: payment.provider,
    providerEventId: `manual-review:${payment.id}:${randomUUID()}`,
    paymentId: payment.id,
    orderId: order.id,
    amount: payment.amount,
    eventType,
    eventData: { adminUserId: input.adminUserId, adminEmail: input.adminEmail, note: input.note },
    processedAt: now,
  } });
  await recordOrderEvent(tx, { orderId: order.id, status: order.status, note: input.note.trim() || label, actorId: input.adminUserId, actorEmail: input.adminEmail });
  await enqueueOrderEmail(tx, order, input.status === "PROOF_RECEIVED" ? "payment_proof_received" : "payment_unidentified");
  return { order, alreadyUpdated: false };
}

export async function confirmOrderPaymentManually(
  tx: Tx,
  orderId: string,
  adminUserId: string,
  note: string,
  now = new Date(),
  adminEmail = "",
) {
  await lockOrder(tx, orderId);
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, number: true, customerName: true, customerEmail: true, total: true, trackingCode: true, trackingUrl: true, status: true, paymentStatus: true,
      items: { select: { variantId: true, quantity: true } },
      payments: { select: { id: true, provider: true, amount: true, paymentStatus: true, expiresAt: true } },
    },
  });
  if (!order) throw new Error("Pedido não encontrado.");
  const payment = order.payments[0];
  if (!payment || payment.amount !== order.total) throw new Error("Pagamento ou valor do pedido não corresponde.");
  if (order.paymentStatus === "APPROVED" && payment.paymentStatus === "APPROVED") return { order, alreadyApproved: true };
  if (payment.provider !== "MANUAL_PIX_STATIC") throw new Error("A confirmação manual está disponível somente para pagamentos PIX estáticos.");
  if (!reviewablePaymentStatuses.includes(order.paymentStatus as (typeof reviewablePaymentStatuses)[number])
    || !reviewablePaymentStatuses.includes(payment.paymentStatus as (typeof reviewablePaymentStatuses)[number])
    || order.status === "CANCELLED") throw new Error("Este pedido não pode receber confirmação de pagamento.");
  if (payment.expiresAt && payment.expiresAt <= now) throw new Error("O prazo de pagamento expirou.");

  const reservations = await tx.stockReservation.findMany({ where: { orderId, releasedAt: null, expiresAt: { gt: now } } });
  const reservedByVariant = new Map<string, number>();
  for (const reservation of reservations) reservedByVariant.set(reservation.variantId, (reservedByVariant.get(reservation.variantId) ?? 0) + reservation.quantity);
  const quantityByVariant = new Map<string, number>();
  for (const item of order.items) quantityByVariant.set(item.variantId, (quantityByVariant.get(item.variantId) ?? 0) + item.quantity);
  for (const [variantId, quantity] of quantityByVariant) {
    if ((reservedByVariant.get(variantId) ?? 0) < quantity) throw new Error("A reserva do pedido não está mais disponível.");
  }
  for (const reservation of reservations) {
    const claimed = await tx.stockReservation.updateMany({
      where: { id: reservation.id, releasedAt: null, expiresAt: { gt: now } },
      data: { releasedAt: now },
    });
    if (!claimed.count) throw new Error("A reserva do pedido já foi liberada ou expirou.");
  }
  for (const [variantId, quantity] of quantityByVariant) {
    const result = await tx.productVariant.updateMany({ where: { id: variantId, stock: { gte: quantity }, reserved: { gte: quantity } }, data: { stock: { decrement: quantity }, reserved: { decrement: quantity } } });
    if (!result.count) throw new Error("Estoque indisponível para confirmar o pedido.");
    await tx.stockMovement.create({ data: { variantId, delta: -quantity, reason: `Pedido ${order.number} pago após conferência bancária`, actorId: adminUserId }, select: { id: true } });
  }

  await tx.payment.update({ where: { id: payment.id }, data: { paymentStatus: "APPROVED", confirmedAt: now, confirmedBy: adminUserId } });
  await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "APPROVED", status: "PAYMENT_APPROVED" }, select: { id: true } });
  await redeemCouponForOrder(tx, orderId, now);
  await tx.paymentEvent.create({ data: { provider: payment.provider, providerEventId: `manual-confirm:${payment.id}`, paymentId: payment.id, orderId, amount: payment.amount, eventType: "MANUAL_CONFIRMED", eventData: { adminUserId, adminEmail, note }, processedAt: now } });
  await recordOrderEvent(tx, { orderId, status: "PAYMENT_APPROVED", note: note || "Recebimento PIX conferido no extrato da conta recebedora pelo administrador.", actorId: adminUserId, actorEmail: adminEmail });
  await enqueueOrderEmail(tx, order, "payment_approved");
  return { order: { id: order.id, status: "PAYMENT_APPROVED", paymentStatus: "APPROVED" }, alreadyApproved: false };
}
