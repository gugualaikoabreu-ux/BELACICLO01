"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CustomerOrderActions({
  orderId,
  canCancel,
  cancellationHref,
  canRequestCancellation,
}: {
  orderId: string;
  canCancel: boolean;
  cancellationHref: string;
  canRequestCancellation: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function cancelOrder() {
    const confirmed = window.confirm(
      "Cancelar este pedido e liberar as unidades reservadas? Se você já transferiu o PIX, fale com a BelaCiclo antes de cancelar para que o pagamento possa ser conferido.",
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Não foi possível cancelar o pedido agora.");
      setMessage("Pedido cancelado. As unidades reservadas foram liberadas.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cancelar o pedido agora.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="customer-order-action">
    {canCancel ? <button className="remove-link" type="button" disabled={busy} onClick={() => void cancelOrder()}>{busy ? "Cancelando…" : "Cancelar pedido"}</button> : canRequestCancellation ? <a className="remove-link" href={cancellationHref}>Solicitar cancelamento</a> : null}
    {message && <span className="order-action-message" role="status">{message}</span>}
  </div>;
}
