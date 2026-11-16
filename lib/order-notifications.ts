import type { Prisma } from "@/generated/prisma/client";

type EventType = "received" | "payment_proof_received" | "payment_unidentified" | "payment_approved" | "payment_after_cancel" | "payment_refunded" | "preparing" | "shipped" | "delivered" | "cancelled";
type OrderForEmail = { id: string; number: string; customerName: string; customerEmail: string; total: number; trackingCode: string | null; trackingUrl: string | null };

export async function enqueueOrderEmail(tx: Prisma.TransactionClient, order: OrderForEmail, event: EventType) {
  await tx.emailOutbox.upsert({
    where: { dedupeKey: `order:${order.id}:${event}` },
    create: {
      dedupeKey: `order:${order.id}:${event}`, recipient: order.customerEmail, template: event,
      payload: { customerName: order.customerName, orderNumber: order.number, total: order.total, trackingCode: order.trackingCode, trackingUrl: order.trackingUrl }
    },
    update: {}
  });
}

export function renderOrderEmail(template: string, rawPayload: unknown) {
  const payload = rawPayload as { customerName?: string; orderNumber?: string; total?: number; trackingCode?: string | null; trackingUrl?: string | null };
  const name = escapeHtml(payload.customerName ?? "cliente");
  const number = escapeHtml(payload.orderNumber ?? "");
  const total = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((payload.total ?? 0) / 100);
  if (template === "received") return { subject: `Pedido recebido — ${number}`, html: `<p>Olá, ${name}.</p><p>Recebemos seu pedido <strong>${number}</strong>, no valor de <strong>${total}</strong>.</p><p>O pagamento está aguardando confirmação. Você pode acompanhar o andamento na sua conta BelaCiclo.</p>` };
  if (template === "payment_proof_received") return { subject: `Comprovante recebido — pedido ${number}`, html: `<p>Olá, ${name}.</p><p>Recebemos o comprovante do pedido <strong>${number}</strong>, no valor de ${total}.</p><p>O comprovante não confirma o pagamento. A equipe vai conferir o crédito no banco.</p>` };
  if (template === "payment_unidentified") return { subject: `Precisamos conferir seu PIX — pedido ${number}`, html: `<p>Olá, ${name}.</p><p>Ainda não conseguimos identificar o PIX do pedido <strong>${number}</strong>, no valor de ${total}.</p><p>Entre em contato com a Bela Ciclo pelo e-mail oficial para conferirmos os dados.</p>` };
  if (template === "payment_approved") return { subject: `Pagamento aprovado — pedido ${number}`, html: `<p>Olá, ${name}.</p><p>Recebemos a confirmação do pagamento PIX do pedido <strong>${number}</strong>.</p><p>Total: ${total}</p>` };
  if (template === "payment_after_cancel") return { subject: `Ação necessária sobre o pagamento — ${number}`, html: `<p>Olá, ${name}.</p><p>O pagamento do pedido <strong>${number}</strong> foi confirmado após o cancelamento do pedido.</p><p>A BelaCiclo precisa conferir a situação e o estorno. Entre em contato antes de realizar um novo pagamento.</p>` };
  if (template === "payment_refunded") return { subject: `Estorno confirmado — ${number}`, html: `<p>Olá, ${name}.</p><p>O provedor informou o estorno do pagamento do pedido <strong>${number}</strong>.</p><p>Consulte o aplicativo da sua instituição financeira para acompanhar o crédito.</p>` };
  if (template === "preparing") return { subject: `Pedido em preparação — ${number}`, html: `<p>Olá, ${name}.</p><p>O pedido <strong>${number}</strong> está em preparação.</p>` };
  if (template === "shipped") {
    const tracking = payload.trackingCode ? `<p>Código de rastreamento: <strong>${escapeHtml(payload.trackingCode)}</strong></p>` : "";
    const link = safeTrackingLink(payload.trackingUrl);
    return { subject: `Seu pedido foi enviado — ${number}`, html: `<p>Olá, ${name}.</p><p>O pedido <strong>${number}</strong> foi registrado como enviado.</p>${tracking}${link ? `<p><a href="${link}">Acompanhar nos Correios</a></p>` : ""}` };
  }
  if (template === "cancelled") return { subject: `Pedido cancelado — ${number}`, html: `<p>Olá, ${name}.</p><p>O pedido <strong>${number}</strong> foi cancelado antes da confirmação de pagamento.</p><p>Se você já fez um PIX, entre em contato com a BelaCiclo para conferência.</p>` };
  return { subject: `Pedido entregue — ${number}`, html: `<p>Olá, ${name}.</p><p>O pedido <strong>${number}</strong> foi registrado como entregue.</p><p>Esperamos que aproveite suas escolhas.</p>` };
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char); }
function safeTrackingLink(value?: string | null) { try { const url = new URL(value ?? ""); return url.protocol === "https:" && url.hostname === "rastreamento.correios.com.br" ? url.toString() : null; } catch { return null; } }
