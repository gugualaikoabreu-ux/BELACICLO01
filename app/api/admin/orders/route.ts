import { getDb } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin";
import { getStoreShippingSettings } from "@/lib/shipping/store-settings";

function getManualReviewStatus(events: Array<{ eventType: string; createdAt: Date }>) {
  const latest = [...events]
    .filter((event) => event.eventType === "MANUAL_PROOF_RECEIVED" || event.eventType === "MANUAL_PAYMENT_UNIDENTIFIED")
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
  if (latest?.eventType === "MANUAL_PROOF_RECEIVED") return "PROOF_RECEIVED";
  if (latest?.eventType === "MANUAL_PAYMENT_UNIDENTIFIED") return "UNIDENTIFIED";
  return null;
}

export async function GET(request: Request) {
  if (!await isAdminRequest(request)) return Response.json({ message: "Acesso restrito." }, { status: 401 });
  let stage = "shipping_settings";
  try {
    const settings = await getStoreShippingSettings();
    const db = getDb();
    stage = "orders";
    const orders = await db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        number: true,
        customerName: true,
        customerEmail: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        discount: true,
        shipping: true,
        shippingServiceName: true,
        ...(settings.orderDeliveryColumnsAvailable ? { shippingDeliveryMinDays: true, shippingDeliveryMaxDays: true } : {}),
        total: true,
        trackingCode: true,
        trackingUrl: true,
        createdAt: true,
        shippingAddress: true,
        items: { select: { id: true, name: true, quantity: true } },
        events: { orderBy: { createdAt: "asc" }, select: { status: true, note: true, createdAt: true } },
        payments: { select: { id: true, provider: true, paymentStatus: true, amount: true, transactionId: true, confirmedAt: true, createdAt: true } },
      },
    });

    const paymentIds = orders.flatMap((order) => order.payments.map((payment) => payment.id));
    const paymentEventsByPayment = new Map<string, Array<{ eventType: string; amount: number; createdAt: Date; processedAt: Date | null }>>();
    if (paymentIds.length) {
      stage = "payment_events";
      try {
        const events = await db.paymentEvent.findMany({
          where: { paymentId: { in: paymentIds } },
          orderBy: { createdAt: "asc" },
          select: { paymentId: true, eventType: true, amount: true, createdAt: true, processedAt: true },
        });
        for (const event of events) {
          if (!event.paymentId) continue;
          paymentEventsByPayment.set(event.paymentId, [...(paymentEventsByPayment.get(event.paymentId) ?? []), event]);
        }
      } catch (error) {
        const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : null;
        console.warn("[admin-orders] optional payment events unavailable", { errorCode });
      }
    }

    const compatibleOrders = orders.map((order) => {
      const payments = order.payments.map((payment) => {
        const events = paymentEventsByPayment.get(payment.id) ?? [];
        const reviewStatus = payment.paymentStatus === "PENDING" ? getManualReviewStatus(events) : null;
        return { ...payment, paymentStatus: reviewStatus ?? payment.paymentStatus, events };
      });
      const displayedPaymentStatus = order.paymentStatus === "PENDING"
        ? payments[0]?.paymentStatus ?? order.paymentStatus
        : order.paymentStatus;
      return {
        ...order,
        paymentStatus: displayedPaymentStatus,
        shippingDeliveryMinDays: "shippingDeliveryMinDays" in order ? order.shippingDeliveryMinDays : null,
        shippingDeliveryMaxDays: "shippingDeliveryMaxDays" in order ? order.shippingDeliveryMaxDays : null,
        events: order.events.map((event) => ({ ...event, actorEmail: null })),
        payments,
      };
    });
    return Response.json({ orders: compatibleOrders });
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error ? String(error.code) : null;
    console.error("[admin-orders] list failed", { stage, errorCode });
    return Response.json({ message: "Não foi possível consultar os pedidos." }, { status: 503 });
  }
}
