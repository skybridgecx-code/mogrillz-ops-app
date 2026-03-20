import type { OrderStatus } from "@/types/domain";

const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  New: "In Prep",
  "In Prep": "Ready",
  Ready: "Delivered",
};

export function getNextOrderStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_ORDER_STATUS[status] ?? null;
}

export function isValidForwardOrderStatusTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
) {
  return getNextOrderStatus(currentStatus) === nextStatus;
}

export function getOrderStatusActionLabel(status: OrderStatus): string | null {
  const nextStatus = getNextOrderStatus(status);
  return nextStatus ? `Mark ${nextStatus}` : null;
}
