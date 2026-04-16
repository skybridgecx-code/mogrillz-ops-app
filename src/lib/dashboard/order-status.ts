import type { OrderStatus } from "@/types/domain";

const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  New: "In Prep",
  "In Prep": "Ready",
  Ready: "Picked Up",
};

export function normalizeOrderStatus(value: unknown): OrderStatus | null {
  if (typeof value !== "string") return null;

  switch (value.trim().toLowerCase().replace(/[_-]+/g, " ")) {
    case "new":
      return "New";
    case "in prep":
      return "In Prep";
    case "ready":
      return "Ready";
    case "delivered":
    case "picked up":
      return "Picked Up";
    case "cancelled":
      return "Cancelled";
    default:
      return null;
  }
}

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
