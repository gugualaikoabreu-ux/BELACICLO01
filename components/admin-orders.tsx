"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatCurrency } from "@/lib/config";

type OrderRow = {
  id: string;
  number: string;
  customerName: string;
  customerEmail: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shipping: number;
  shippingServiceName: string | null;
  shippingDeliveryMinDays: number | null;
  shippingDeliveryMaxDays: number | null;
  total: number;
  trackingCode: string | null;
  trackingUrl: string | null;
  createdAt: string;
  shippingAddress: {
    recipient: string;
    postalCode: string;
    street: string;
    number: string;
    complement?: string | null;
    reference?: string | null;
    neighborhood: string;
    city: string;
    state: string;
  };
  items: { name: string; quantity: number }[];
  events: { status: string; note: string | null; actorEmail: string | null; createdAt: string }[];
  payments: {
    provider: string;
    paymentStatus: string;
    amount: number;
    transactionId: string | null;
    confirmedAt: string | null;
    createdAt: string;
    events: { eventType: string; amount: number; createdAt: string; processedAt: string | null }[];
  }[];
};

export function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [message, setMessage] = useState("");
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  async function refresh() {
    const response = await fetch("/api/admin/orders", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setOrders(data.orders);
    else setMessage(data.message);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function update(event: FormEvent<HTMLFormElement>, order: OrderRow) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get("status"));
    const payload = {
      status: status || undefined,
      trackingCode: String(form.get("trackingCode")) || undefined,
      trackingUrl: String(form.get("trackingUrl")) || undefined,
      note: String(form.get("note")) || undefined,
    };
    const response = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    setMessage(data.message ?? "Pedido atualizado.");
    if (response.ok) await refresh();
  }

  async function confirmPayment(order: OrderRow) {
    if (!window.confirm(`Confirme somente depois de verificar no extrato da conta recebedora que o PIX de ${formatCurrency(order.total)} entrou para o pedido ${order.number}.`)) return;
    setBusyOrderId(order.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/confirm-payment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: "Recebimento conferido no extrato da conta recebedora." }),
      });
      const data = await response.json();
      setMessage(data.message ?? "Não foi possível confirmar o pagamento.");
      if (response.ok) await refresh();
    } catch {
      setMessage("Não foi possível confirmar o pagamento.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function updatePaymentReview(order: OrderRow, status: "PROOF_RECEIVED" | "UNIDENTIFIED") {
    const note = reviewNotes[order.id]?.trim() ?? "";
    if (status === "UNIDENTIFIED" && note.length < 3) { setMessage("Informe o motivo pelo qual o pagamento não foi identificado."); return; }
    setBusyOrderId(order.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/payment-review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, note }),
      });
      const data = await response.json();
      setMessage(data.message ?? "Não foi possível atualizar a conferência.");
      if (response.ok) await refresh();
    } catch {
      setMessage("Não foi possível atualizar a conferência do pagamento.");
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="admin-content">
      <p className="form-feedback" aria-live="polite">{message}</p>
      <div className="admin-order-list">
        {orders.map((order) => {
          const history = [
            ...order.events.map((event) => ({ at: event.createdAt, label: `Pedido · ${orderStatusLabel(event.status)}`, detail: [event.note, event.actorEmail ? `Responsável: ${event.actorEmail}` : ""].filter(Boolean).join(" · ") })),
            ...order.payments.flatMap((payment) => payment.events.map((event) => ({
              at: event.processedAt ?? event.createdAt,
              label: `Pagamento · ${event.eventType}`,
              detail: `${payment.provider} · ${formatCurrency(event.amount)}`,
            }))),
          ].sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime());
          const payment = order.payments[0];
          const paymentDetail = payment ? ` · PIX manual · ${formatCurrency(payment.amount)}` : "";
          const awaitingManualReview = ["PENDING", "PROOF_RECEIVED", "UNIDENTIFIED"].includes(order.paymentStatus);

          return (
            <article className="admin-order-card" key={order.id}>
              <div className="admin-order-head">
                <div>
                  <b>Pedido {order.number}</b>
                  <small>{new Date(order.createdAt).toLocaleString("pt-BR")} · {order.customerName} · {order.customerEmail}</small>
                </div>
                <b>{formatCurrency(order.total)}</b>
              </div>
              <p>{order.items.map((item) => `${item.name} × ${item.quantity}`).join(" · ")}</p>
              <p className="admin-order-address">Entrega para {order.shippingAddress.recipient} · {order.shippingAddress.street}, {order.shippingAddress.number}{order.shippingAddress.complement ? ` · ${order.shippingAddress.complement}` : ""} · {order.shippingAddress.neighborhood}, {order.shippingAddress.city}/{order.shippingAddress.state} · CEP {order.shippingAddress.postalCode}{order.shippingAddress.reference ? ` · Referência: ${order.shippingAddress.reference}` : ""}</p>
              <p className="admin-order-shipping">Produtos: {formatCurrency(order.subtotal)}{order.discount > 0 ? ` · Cupom: −${formatCurrency(order.discount)}` : ""} · Entrega{order.shippingServiceName ? ` · ${order.shippingServiceName}` : ""}: {formatCurrency(order.shipping)}{typeof order.shippingDeliveryMinDays === "number" && typeof order.shippingDeliveryMaxDays === "number" ? ` · ${order.shippingDeliveryMinDays === order.shippingDeliveryMaxDays ? order.shippingDeliveryMinDays : `${order.shippingDeliveryMinDays}–${order.shippingDeliveryMaxDays}`} dias úteis estimados` : ""}</p>
              <div className="order-status-line">
                <span>Pagamento: <b>{paymentStatusLabel(order.paymentStatus)}</b>{paymentDetail}</span>
                <span>Pedido: <b>{orderStatusLabel(order.status)}</b></span>
                {order.trackingCode && <span>Rastreio: <b>{order.trackingCode}</b></span>}
                {payment?.confirmedAt && <span>Conferido: <b>{new Date(payment.confirmedAt).toLocaleString("pt-BR")}</b></span>}
              </div>
              {awaitingManualReview && payment?.provider === "MANUAL_PIX_STATIC" && (
                <div className="checkout-status">
                  <p>{order.paymentStatus === "PENDING" ? "Aguardando pagamento ou comprovante." : order.paymentStatus === "PROOF_RECEIVED" ? "O comprovante foi recebido; confirme somente após conferir o crédito no extrato bancário." : "O pagamento está marcado como não identificado. Registre nova observação se houver outra conferência."}</p>
                  <label>Observação da conferência<input value={reviewNotes[order.id] ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [order.id]: event.target.value }))} maxLength={500} placeholder="Ex.: comprovante recebido no e-mail oficial"/></label>
                  <div className="payment-review-actions">
                    {order.paymentStatus !== "PROOF_RECEIVED" && <button className="button button-outline" disabled={busyOrderId === order.id} onClick={() => void updatePaymentReview(order, "PROOF_RECEIVED")}>Marcar comprovante recebido</button>}
                    {order.paymentStatus !== "UNIDENTIFIED" && <button className="button button-outline" disabled={busyOrderId === order.id || (reviewNotes[order.id]?.trim().length ?? 0) < 3} onClick={() => void updatePaymentReview(order, "UNIDENTIFIED")}>Marcar pagamento não identificado</button>}
                    <button className="button button-dark" disabled={busyOrderId === order.id} onClick={() => void confirmPayment(order)}>
                    {busyOrderId === order.id ? "Confirmando…" : "Confirmar PIX recebido"}
                    </button>
                  </div>
                </div>
              )}
              {order.paymentStatus === "APPROVED" && order.status === "CANCELLED" && <div className="checkout-status"><b>Pagamento confirmado depois do cancelamento — revisão obrigatória</b><p>Não separe nem envie este pedido. Confira o caso e faça contato com o cliente pelo canal oficial.</p></div>}
              <form className="admin-order-form" onSubmit={(event) => void update(event, order)}>
                <label>Atualizar status<select name="status" defaultValue=""><option value="">Manter status</option><option value="PREPARING">Em preparação</option><option value="SHIPPED">Enviado</option><option value="DELIVERED">Entregue</option><option value="CANCELLED">Cancelado</option></select></label>
                <label>Código Correios<input name="trackingCode" defaultValue={order.trackingCode ?? ""}/></label>
                <label>Link oficial de rastreio<input name="trackingUrl" type="url" defaultValue={order.trackingUrl ?? ""}/></label>
                <label>Nota do evento<input name="note" placeholder="Informação real sobre o pedido"/></label>
                <button className="button button-dark">Salvar atualização →</button>
              </form>
              <details className="order-history">
                <summary>Histórico de alterações ({history.length})</summary>
                <ol>{history.map((event, index) => (
                  <li key={`${event.at}-${index}`}>
                    <b>{event.label}</b>
                    <time>{new Date(event.at).toLocaleString("pt-BR")}</time>
                    {event.detail && <p>{event.detail}</p>}
                  </li>
                ))}</ol>
              </details>
            </article>
          );
        })}
        {orders.length === 0 && <p className="empty-note">Nenhum pedido registrado.</p>}
      </div>
    </div>
  );
}

function paymentStatusLabel(status: string) {
  return ({ PENDING: "Aguardando pagamento", PROOF_RECEIVED: "Comprovante enviado", UNIDENTIFIED: "Pagamento não identificado", APPROVED: "Pagamento confirmado", REFUSED: "Pagamento recusado", EXPIRED: "Pedido cancelado/expirado", REFUNDED: "Pagamento estornado" } as Record<string, string>)[status] ?? status;
}

function orderStatusLabel(status: string) {
  return ({ RECEIVED: "Aguardando pagamento", PAYMENT_APPROVED: "Pagamento confirmado", PREPARING: "Em preparação", SHIPPED: "Enviado", DELIVERED: "Entregue", CANCELLED: "Pedido cancelado" } as Record<string, string>)[status] ?? status;
}
