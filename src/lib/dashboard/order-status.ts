import type { OrderStatus } from "@/types/domain";

const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  New: "In Prep",
  "In Prep": "Ready",
  Ready: "Picked Up",
};

const CANCELLABLE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set(["New", "In Prep", "Ready"]);

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  New: "New Request",
  "In Prep": "In Prep",
  Ready: "Ready For Pickup",
  "Picked Up": "Completed",
  Cancelled: "Cancelled",
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

export function canCancelOrderStatus(status: OrderStatus) {
  return CANCELLABLE_ORDER_STATUSES.has(status);
}

export function isRiskyOrderStatusTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
) {
  if (nextStatus === "Picked Up") return true;
  if (nextStatus === "Cancelled" && canCancelOrderStatus(currentStatus)) return true;
  return false;
}

export function isValidOrderStatusTransition(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
) {
  if (isValidForwardOrderStatusTransition(currentStatus, nextStatus)) return true;
  if (nextStatus === "Cancelled" && canCancelOrderStatus(currentStatus)) return true;
  return false;
}

export function getOrderStatusDisplayLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABEL[status] ?? status;
}

export function getOrderStatusActionLabel(status: OrderStatus): string | null {
  const nextStatus = getNextOrderStatus(status);
  return nextStatus ? `Mark ${getOrderStatusDisplayLabel(nextStatus)}` : null;
}
