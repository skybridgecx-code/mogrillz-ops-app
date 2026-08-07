import type { OrderStatus } from "@/types/domain";

const BUSINESS_TIME_ZONE = "America/New_York";

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

export type PickupTimingBucket = "today" | "tomorrow" | "future" | "unavailable";

function addCalendarDay(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function getBusinessDateKey(referenceDate: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
  }).formatToParts(referenceDate);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function getPickupTimingBucket(
  serviceDate: string | null,
  referenceDate = new Date(),
): PickupTimingBucket {
  if (!serviceDate) return "unavailable";

  const parsedServiceDate = new Date(`${serviceDate}T12:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate) ||
    !Number.isFinite(parsedServiceDate.getTime()) ||
    parsedServiceDate.toISOString().slice(0, 10) !== serviceDate
  ) {
    return "unavailable";
  }

  const today = getBusinessDateKey(referenceDate);
  if (!today) return "unavailable";
  const tomorrow = addCalendarDay(today);

  if (serviceDate <= today) return "today";
  if (serviceDate === tomorrow) return "tomorrow";
  return "future";
}

export function getPickupTimingLabel(serviceDate: string | null, referenceDate = new Date()) {
  const bucket = getPickupTimingBucket(serviceDate, referenceDate);

  switch (bucket) {
    case "today":
      return "Today";
    case "tomorrow":
      return "Tomorrow";
    case "future":
      return "Future pickup";
    case "unavailable":
      return "Date unavailable";
    default:
      return "Date unavailable";
  }
}

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
