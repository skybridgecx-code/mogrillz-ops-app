import type { InventoryItem, Order } from "@/types/domain";

export const DEFAULT_BUSINESS_TIME_ZONE = "America/New_York";

const RECOGNIZED_PAYMENT_STATUSES = new Set([
  "paid",
  "succeeded",
  "complete",
  "completed",
  "captured",
]);

function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function getBusinessDate(
  referenceDate = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    throw new Error(`Could not resolve a business date for timezone ${timeZone}.`);
  }

  return `${year}-${month}-${day}`;
}

export function isRecognizedRevenueOrder(order: Order) {
  if (order.status === "Cancelled") return false;
  return RECOGNIZED_PAYMENT_STATUSES.has(normalizeValue(order.paymentStatus));
}

export function getRecognizedRevenueOrders(orders: Order[]) {
  return orders.filter(isRecognizedRevenueOrder);
}

export function getRecognizedRevenueCents(orders: Order[]) {
  return getRecognizedRevenueOrders(orders).reduce(
    (sum, order) => sum + Math.max(0, order.totalCents),
    0,
  );
}

export function getAverageRecognizedOrderValueCents(orders: Order[]) {
  const recognized = getRecognizedRevenueOrders(orders);
  if (!recognized.length) return 0;

  return Math.round(
    recognized.reduce((sum, order) => sum + Math.max(0, order.totalCents), 0) /
      recognized.length,
  );
}

export function getOrdersForBusinessDate(
  orders: Order[],
  referenceDate = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
) {
  const businessDate = getBusinessDate(referenceDate, timeZone);
  return orders.filter(
    (order) => order.status !== "Cancelled" && order.serviceDate === businessDate,
  );
}

export function getInventoryHealthPercent(inventory: InventoryItem[]) {
  if (!inventory.length) return null;

  const healthyCount = inventory.filter(
    (item) => item.status !== "Low" && item.status !== "Out",
  ).length;

  return Math.round((healthyCount / inventory.length) * 100);
}
