export type OrderLifecycleStatus = "RECEIVED" | "PAYMENT_APPROVED" | "PREPARING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

const allowedTransitions: Record<OrderLifecycleStatus, readonly OrderLifecycleStatus[]> = {
  RECEIVED: ["CANCELLED"],
  PAYMENT_APPROVED: ["PREPARING", "CANCELLED"],
  PREPARING: ["PREPARING", "SHIPPED"],
  SHIPPED: ["SHIPPED", "DELIVERED"],
  DELIVERED: ["DELIVERED"],
  CANCELLED: ["CANCELLED"],
};

export function canTransitionOrderStatus(current: OrderLifecycleStatus, next: OrderLifecycleStatus) {
  return allowedTransitions[current].includes(next);
}

export function describeTrackingChanges(
  current: { trackingCode: string | null; trackingUrl: string | null },
  next: { trackingCode?: string | null; trackingUrl?: string | null },
) {
  const changes: string[] = [];
  if (next.trackingCode !== undefined && next.trackingCode !== current.trackingCode) {
    changes.push(next.trackingCode ? "Código de rastreamento atualizado." : "Código de rastreamento removido.");
  }
  if (next.trackingUrl !== undefined && next.trackingUrl !== current.trackingUrl) {
    changes.push(next.trackingUrl ? "Link de rastreamento atualizado." : "Link de rastreamento removido.");
  }
  return changes;
}

export function buildOrderEventNote(note: string | undefined, trackingChanges: readonly string[]) {
  return [note?.trim(), ...trackingChanges].filter((part): part is string => Boolean(part)).join(" ") || null;
}
