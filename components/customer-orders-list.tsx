"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CustomerOrderActions } from "@/components/customer-order-actions";

type CustomerOrder = {
  id: string;
  number: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  total: number;
  itemCount: number;
};

const orderStatusLabels: Record<string, string> = {
  RECEIVED: "Aguardando pagamento",
  PAYMENT_APPROVED: "Pagamento confirmado",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function OrderCard({
  order,
  email,
  trashed = false,
  onMoveToTrash,
  onRestore,
}: {
  order: CustomerOrder;
  email: string;
  trashed?: boolean;
  onMoveToTrash?: (id: string) => void;
  onRestore?: (id: string) => void;
}) {
  const canCancel = order.status === "RECEIVED" && order.paymentStatus === "PENDING";
  const canRequestCancellation = order.status !== "CANCELLED" && order.status !== "DELIVERED";
  const cancellationHref = `mailto:${email}?subject=${encodeURIComponent(`Solicitação de cancelamento do pedido ${order.number}`)}`;

  return <article className={`order-card${trashed ? " order-card-trashed" : ""}`}>
    <div><b>Pedido {order.number}</b><span>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(order.createdAt))}</span></div>
    <div><b>{orderStatusLabels[order.status] ?? order.status.replaceAll("_", " ")}</b><span>{order.itemCount} item(ns)</span></div>
    <b>{formatMoney(order.total)}</b>
    <div className="order-card-actions">
      <Link href={`/pedido/${encodeURIComponent(order.number)}`}>Acompanhar →</Link>
      {trashed
        ? <button className="order-trash-action order-restore-action" type="button" onClick={() => onRestore?.(order.id)}>Restaurar pedido</button>
        : order.status === "CANCELLED"
          ? <button className="order-trash-action" type="button" onClick={() => onMoveToTrash?.(order.id)} aria-label={`Mover pedido ${order.number} para a lixeira`}>
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3.5 5.5h13M8 8.5v6m4-6v6M5.5 5.5l.7 11h7.6l.7-11M7.5 5.5V3.8h5V5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Mover para lixeira
            </button>
          : <CustomerOrderActions orderId={order.id} canCancel={canCancel} cancellationHref={cancellationHref} canRequestCancellation={canRequestCancellation} />}
    </div>
  </article>;
}

export function CustomerOrdersList({
  orders,
  userId,
  email,
}: {
  orders: CustomerOrder[];
  userId: string;
  email: string;
}) {
  const storageKey = `belaciclo:orders-trash:${userId}`;
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(stored)) setHiddenIds(new Set(stored.filter((id): id is string => typeof id === "string")));
    } catch {
      setHiddenIds(new Set());
    }
    setHydrated(true);
  }, [storageKey]);

  const trashedOrders = useMemo(
    () => hydrated ? orders.filter((order) => order.status === "CANCELLED" && hiddenIds.has(order.id)) : [],
    [hydrated, hiddenIds, orders],
  );
  const visibleOrders = useMemo(
    () => orders.filter((order) => !hydrated || order.status !== "CANCELLED" || !hiddenIds.has(order.id)),
    [hydrated, hiddenIds, orders],
  );

  function saveHiddenIds(next: Set<string>) {
    setHiddenIds(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* The current view still updates if storage is unavailable. */ }
  }

  function moveToTrash(id: string) {
    const next = new Set(hiddenIds);
    next.add(id);
    saveHiddenIds(next);
  }

  function restoreOrder(id: string) {
    const next = new Set(hiddenIds);
    next.delete(id);
    saveHiddenIds(next);
  }

  return <>
    <div className="orders-trash-toolbar">
      <button className="orders-trash-toggle" type="button" onClick={() => setTrashOpen((open) => !open)} aria-expanded={trashOpen}>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3.5 5.5h13M8 8.5v6m4-6v6M5.5 5.5l.7 11h7.6l.7-11M7.5 5.5V3.8h5v1.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Lixeira <span>{trashedOrders.length}</span>
      </button>
      {trashedOrders.length > 0 && <small>Pedidos cancelados removidos da lista principal</small>}
    </div>

    {visibleOrders.length > 0
      ? visibleOrders.map((order) => <OrderCard key={order.id} order={order} email={email} onMoveToTrash={moveToTrash} />)
      : <div className="empty-state"><h2>{orders.length ? "Seus pedidos cancelados estão na lixeira." : "Nenhum pedido por aqui."}</h2><p>{orders.length ? "Você pode restaurá-los a qualquer momento pela lixeira." : "Os pedidos realizados aparecerão nesta área."}</p></div>}

    {trashOpen && <section className="orders-trash-panel" aria-label="Lixeira de pedidos cancelados">
      <div className="orders-trash-heading"><h2>Lixeira</h2><p>Somente você vê esta organização. Os pedidos continuam registrados com segurança.</p></div>
      {trashedOrders.length
        ? trashedOrders.map((order) => <OrderCard key={order.id} order={order} email={email} trashed onRestore={restoreOrder} />)
        : <p className="orders-trash-empty">Nenhum pedido cancelado na lixeira.</p>}
    </section>}
  </>;
}
