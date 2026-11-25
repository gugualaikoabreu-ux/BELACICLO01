import Link from "next/link";
import { notFound } from "next/navigation";
import { PixPayment } from "@/components/pix-payment";
import { PaymentGuides } from "@/components/payment-guides";
import { getDb } from "@/lib/db";
import { getManualPixRecipientKey, getManualPixRecipientName, renderPixQrCodeDataUrl } from "@/lib/payments/service";
import { getCurrentUser } from "@/lib/supabase/server";
import { createPageMetadata } from "@/lib/seo";
import { formatCurrency, storeConfig } from "@/lib/config";
import { getStoreShippingSettings } from "@/lib/shipping/store-settings";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "Acompanhar pedido",
  description: "Consulte o andamento do seu pedido BelaCiclo.",
  noIndex: true,
});

const stages = ["RECEIVED", "PAYMENT_APPROVED", "PREPARING", "SHIPPED", "DELIVERED"];
const labels: Record<string, string> = {
  RECEIVED: "Pedido recebido",
  PAYMENT_APPROVED: "Pagamento aprovado",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
};
const paymentLabels: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  PROOF_RECEIVED: "Comprovante enviado · aguardando conferência",
  UNIDENTIFIED: "Pagamento não identificado",
  APPROVED: "Pagamento confirmado",
  REFUSED: "Pagamento recusado",
  EXPIRED: "Pagamento expirado",
  REFUNDED: "Pagamento estornado",
};

export default async function TrackOrderPage({ params }: { params: Promise<{ number: string }> }) {
  if (!process.env.DATABASE_URL) {
    return <section className="page-section"><div className="page-heading"><span className="eyebrow">ACOMPANHAMENTO</span><h1>Status do <em>pedido.</em></h1></div><p className="empty-note">O acompanhamento ficará disponível quando o banco de dados e os pedidos reais estiverem ativos.</p></section>;
  }

  const { number } = await params;
  const user = await getCurrentUser();
  if (!user?.id) {
    return <section className="page-section"><div className="page-heading"><h1>Acompanhe pelo <em>seu acesso.</em></h1></div><p>Entre na sua conta para consultar seus pedidos.</p><Link href="/minha-conta">Acessar conta →</Link></section>;
  }

  const shippingSettings = await getStoreShippingSettings();
  const order = await getDb().order.findFirst({
    where: { number, userId: user.id },
    select: {
      id: true, number: true, status: true, paymentStatus: true, shipping: true, shippingServiceName: true, trackingCode: true, trackingUrl: true,
      ...(shippingSettings.orderDeliveryColumnsAvailable ? { shippingDeliveryMinDays: true, shippingDeliveryMaxDays: true } : {}),
      events: { orderBy: { createdAt: "asc" }, select: { status: true, note: true, createdAt: true } },
      payments: { select: {
        id: true, provider: true, paymentStatus: true, amount: true, pixCopyPaste: true, expiresAt: true, createdAt: true,
        events: { orderBy: { createdAt: "desc" }, select: { eventType: true, createdAt: true } },
      } },
    },
  });
  if (!order) notFound();

  const deliveryEstimate = shippingSettings.orderDeliveryColumnsAvailable
    ? { minDays: order.shippingDeliveryMinDays ?? null, maxDays: order.shippingDeliveryMaxDays ?? null }
    : { minDays: null, maxDays: null };

  const lastReviewEvent = order.payments[0]?.events.find((event) => event.eventType === "MANUAL_PROOF_RECEIVED" || event.eventType === "MANUAL_PAYMENT_UNIDENTIFIED");
  const reviewStatus = lastReviewEvent?.eventType === "MANUAL_PROOF_RECEIVED" ? "PROOF_RECEIVED" : lastReviewEvent?.eventType === "MANUAL_PAYMENT_UNIDENTIFIED" ? "UNIDENTIFIED" : null;
  const displayPaymentStatus = order.paymentStatus === "PENDING" ? reviewStatus ?? order.paymentStatus : order.paymentStatus;
  const pendingPayment = ["PENDING", "PROOF_RECEIVED", "UNIDENTIFIED"].includes(displayPaymentStatus) ? order.payments[0] : undefined;
  const qrCodeDataUrl = pendingPayment?.pixCopyPaste ? await renderPixQrCodeDataUrl(pendingPayment.pixCopyPaste) : undefined;

  return (
    <section className="page-section tracking-page">
      <div className="page-heading">
        <span className="eyebrow">ACOMPANHAMENTO</span>
        <h1>Pedido <em>{order.number}.</em></h1>
        <p>Atualizações registradas para este pedido.</p>
      </div>
      <div className="checkout-status" aria-live="polite">
        <b>{order.status === "CANCELLED" ? "Pedido cancelado" : paymentLabels[displayPaymentStatus] ?? "Status do pagamento atualizado"}</b>
        <p>{displayPaymentStatus === "PENDING" ? <>Faça o PIX manual e, se desejar, envie o comprovante para <a href={`mailto:${storeConfig.email}?subject=${encodeURIComponent(`Comprovante do pedido ${order.number}`)}`}>{storeConfig.email}</a>. O pagamento só é confirmado após conferência no banco.</> : displayPaymentStatus === "PROOF_RECEIVED" ? <>A Bela Ciclo recebeu o comprovante. Ainda estamos conferindo o crédito no banco; o comprovante não confirma o pagamento. Dúvidas: <a href={`mailto:${storeConfig.email}`}>{storeConfig.email}</a>.</> : displayPaymentStatus === "UNIDENTIFIED" ? <>Ainda não foi possível identificar o crédito. Entre em contato pelo <a href={`mailto:${storeConfig.email}?subject=${encodeURIComponent(`Pagamento do pedido ${order.number}`)}`}>{storeConfig.email}</a>, informando o número do pedido.</> : displayPaymentStatus === "EXPIRED" ? <>A reserva de estoque expirou. Se você pagou depois do prazo, entre em contato com a Bela Ciclo pelo <a href={`mailto:${storeConfig.email}`}>{storeConfig.email}</a> para conferência manual.</> : displayPaymentStatus === "APPROVED" ? "O recebimento foi conferido pela equipe Bela Ciclo." : order.status === "CANCELLED" ? "Este pedido foi cancelado." : `Situação do pedido: ${labels[order.status] ?? order.status}.`}</p>
      </div>
      {order.paymentStatus === "APPROVED" && <PaymentGuides mode="approved" />}
      <div className="cart-summary tracking-shipping-summary"><h2>Entrega do pedido</h2><div><span>{order.shippingServiceName ?? "Frete"}</span><b>{formatCurrency(order.shipping)}</b></div>{deliveryEstimate.minDays !== null && deliveryEstimate.maxDays !== null && <div><span>Prazo estimado</span><b>{deliveryEstimate.minDays === deliveryEstimate.maxDays ? deliveryEstimate.minDays : `${deliveryEstimate.minDays}–${deliveryEstimate.maxDays}`} dias úteis</b></div>}</div>
      {order.shippingServiceName === "Frete a combinar" && <div className="checkout-status"><b>Frete pendente de combinação</b><p>O pagamento registrado neste pedido cobre apenas os produtos. A BelaCiclo combinará e cobrará o frete separadamente antes do envio.</p></div>}
      <div className="timeline">
        {stages.map((stage) => {
          const event = order.events.find((item) => item.status === stage);
          const current = order.status === stage;
          const done = stages.indexOf(order.status) >= stages.indexOf(stage);
          return (
            <div className={`timeline-item ${done ? "done" : ""} ${current ? "current" : ""}`} key={stage}>
              <span className="timeline-dot" />
              <div>
                <b>{labels[stage]}</b>
                {event && <time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(event.createdAt)}</time>}
                {event?.note && <p>{event.note}</p>}
              </div>
            </div>
          );
        })}
      </div>
      {pendingPayment?.pixCopyPaste && qrCodeDataUrl && pendingPayment.expiresAt && (
        <PixPayment
          orderNumber={order.number}
          total={pendingPayment.amount}
          copyPaste={pendingPayment.pixCopyPaste}
          recipientKey={getManualPixRecipientKey()}
          recipientName={getManualPixRecipientName()}
          qrCodeDataUrl={qrCodeDataUrl}
          expiresAt={pendingPayment.expiresAt}
        />
      )}
      {order.trackingCode && (
        <div className="tracking-code">
          <span>Código de rastreamento</span>
          <b>{order.trackingCode}</b>
          {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noreferrer">Acompanhar nos Correios ↗</a>}
        </div>
      )}
    </section>
  );
}
