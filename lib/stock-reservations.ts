import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { releaseCouponForOrder } from "@/lib/coupons";

type Tx = Prisma.TransactionClient;
const unpaidManualStatuses = ["PENDING", "PROOF_RECEIVED", "UNIDENTIFIED"] as const;

export async function releaseOrderReservations(tx: Tx, orderId: string, now = new Date()) {
  const reservations = await tx.stockReservation.findMany({ where: { orderId, releasedAt: null } });
  for (const reservation of reservations) {
    const claimed = await tx.stockReservation.updateMany({ where: { id: reservation.id, releasedAt: null }, data: { releasedAt: now } });
    if (!claimed.count) continue;
    const variant = await tx.productVariant.updateMany({ where: { id: reservation.variantId, reserved: { gte: reservation.quantity } }, data: { reserved: { decrement: reservation.quantity } } });
    if (!variant.count) throw new Error("Reserva de estoque inconsistente.");
    await tx.stockMovement.create({ data: { variantId: reservation.variantId, delta: 0, reason: `Reserva liberada do pedido ${orderId}` }, select: { id: true } });
  }
}

export async function expirePendingReservations(now = new Date()) {
  if (!process.env.DATABASE_URL) return 0;
  return getDb().$transaction(async (tx) => {
    const expired = await tx.stockReservation.findMany({ where: { expiresAt: { lte: now }, releasedAt: null }, select: { id: true, orderId: true }, orderBy: { expiresAt: "asc" }, take: 500 });
    const orderIds = [...new Set(expired.map((reservation) => reservation.orderId))];
    let expiredCount = 0;

    for (const orderId of orderIds) {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        // Keep this maintenance path compatible with the shop database before
        // the regional-shipping migration adds optional delivery columns.
        select: {
          id: true,
          number: true,
          status: true,
          paymentStatus: true,
          payments: { select: { id: true, provider: true, amount: true } },
        },
      });
      if (!order || !unpaidManualStatuses.includes(order.paymentStatus as (typeof unpaidManualStatuses)[number]) || order.status === "CANCELLED") {
        await releaseOrderReservations(tx, orderId, now);
        await releaseCouponForOrder(tx, orderId, now);
        continue;
      }
      const reservations = await tx.stockReservation.findMany({ where: { orderId, expiresAt: { lte: now }, releasedAt: null } });
      for (const reservation of reservations) {
        const claimed = await tx.stockReservation.updateMany({ where: { id: reservation.id, releasedAt: null }, data: { releasedAt: now } });
        if (!claimed.count) continue;
        const variant = await tx.productVariant.updateMany({ where: { id: reservation.variantId, reserved: { gte: reservation.quantity } }, data: { reserved: { decrement: reservation.quantity } } });
        if (!variant.count) throw new Error("Reserva de estoque inconsistente.");
        await tx.stockMovement.create({ data: { variantId: reservation.variantId, delta: 0, reason: `Reserva expirada do pedido ${order.number}` } });
      }
      await releaseCouponForOrder(tx, orderId, now);
      const remaining = await tx.stockReservation.count({ where: { orderId, releasedAt: null } });
      if (remaining) continue;

      // Recheck after acquiring the order lock so only a still-unpaid order expires.
      const latestOrder = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, paymentStatus: true } });
      if (!latestOrder || !unpaidManualStatuses.includes(latestOrder.paymentStatus as (typeof unpaidManualStatuses)[number]) || latestOrder.status === "CANCELLED") continue;

      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED", paymentStatus: "EXPIRED" },
        select: { id: true },
      });
      // Compare payment statuses as text so checkout stays compatible with databases
      // that have not yet applied the additive manual-review enum migration.
      await tx.$executeRaw`
        UPDATE "payments"
        SET "paymentStatus" = 'EXPIRED'::"PaymentStatus", "updatedAt" = NOW()
        WHERE "orderId" = ${orderId}
          AND "paymentStatus"::text IN ('PENDING', 'PROOF_RECEIVED', 'UNIDENTIFIED')
      `;
      const payment = order.payments[0];
      if (payment) {
        await tx.paymentEvent.create({ data: { provider: payment.provider, providerEventId: `reservation-expired:${payment.id}`, paymentId: payment.id, orderId, amount: payment.amount, eventType: "EXPIRED", eventData: { reason: "reservation_timeout" }, processedAt: now } });
      }
      await tx.orderEvent.create({
        data: { orderId, status: "CANCELLED", note: "O prazo para pagamento expirou; as unidades reservadas foram liberadas." },
        select: { id: true, orderId: true, status: true, note: true, createdAt: true },
      });
      expiredCount += 1;
    }
    return expiredCount;
  });
}
