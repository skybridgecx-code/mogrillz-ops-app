import type { DashboardSnapshot, InventoryItem, Order } from "../../types/domain";

export const DEFAULT_BUSINESS_TIME_ZONE = "America/New_York";

const RECOGNIZED_PAYMENT_STATUSES = new Set(["paid", "captured", "succeeded"]);

export interface CanonicalMetricOptions {
  now?: Date | string | number;
  timeZone?: string;
  formatCurrency?: (cents: number) => string;
}

function toValidDate(value: Date | string | number) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new RangeError("Canonical metrics require a valid current date.");
  }

  return date;
}

function defaultFormatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function getBusinessDateKey(
  now: Date | string | number = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
) {
  const date = toValidDate(now);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new RangeError("Canonical metrics could not resolve the business date.");
  }

  return `${year}-${month}-${day}`;
}

export function formatBusinessDateLabel(
  now: Date | string | number = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(toValidDate(now));
}

export function normalizePaymentStatus(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isRecognizedPaidOrder(
  order: Pick<Order, "paymentStatus" | "status">,
) {
  return (
    order.status !== "Cancelled" &&
    RECOGNIZED_PAYMENT_STATUSES.has(normalizePaymentStatus(order.paymentStatus))
  );
}

export function buildCanonicalKpis(
  orders: readonly Order[],
  inventory: readonly InventoryItem[],
  options: CanonicalMetricOptions = {},
): DashboardSnapshot["kpis"] {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? DEFAULT_BUSINESS_TIME_ZONE;
  const formatCurrency = options.formatCurrency ?? defaultFormatCurrency;
  const businessDate = getBusinessDateKey(now, timeZone);

  const todayOrders = orders.filter(
    (order) => order.status !== "Cancelled" && order.serviceDate === businessDate,
  );
  const todayPickupCount = todayOrders.filter(
    (order) => order.fulfillmentMethod === "pickup",
  ).length;
  const todayDeliveryCount = todayOrders.length - todayPickupCount;

  const recognizedRevenueOrders = orders.filter(isRecognizedPaidOrder);
  const recognizedRevenueCents = recognizedRevenueOrders.reduce(
    (sum, order) => sum + order.totalCents,
    0,
  );

  const lowStockCount = inventory.filter(
    (item) => item.status === "Low" || item.status === "Out",
  ).length;
  const readyStockCount = inventory.length - lowStockCount;
  const stockReadiness = inventory.length
    ? Math.round((readyStockCount / inventory.length) * 100)
    : null;

  return [
    {
      label: "Today's Service Orders",
      value: String(todayOrders.length),
      delta: todayOrders.length
        ? `${todayPickupCount} pickup · ${todayDeliveryCount} delivery`
        : `No orders scheduled for ${businessDate}`,
      tone: "gold",
    },
    {
      label: "Paid Revenue",
      value: formatCurrency(recognizedRevenueCents),
      delta: `${recognizedRevenueOrders.length} recognized payment${recognizedRevenueOrders.length === 1 ? "" : "s"}`,
      tone: "green",
    },
    {
      label: "Low Stock Items",
      value: String(lowStockCount),
      delta: lowStockCount ? "Needs attention before prep" : "All stocked for service",
      tone: lowStockCount ? "red" : "green",
    },
    {
      label: "Stock Readiness",
      value: stockReadiness === null ? "—" : `${stockReadiness}%`,
      delta:
        stockReadiness === null
          ? "No inventory data"
          : `${readyStockCount} of ${inventory.length} items ready`,
      tone: "blue",
    },
  ];
}

export function withCanonicalMetrics(
  snapshot: DashboardSnapshot,
  options: CanonicalMetricOptions = {},
): DashboardSnapshot {
  return {
    ...snapshot,
    kpis: buildCanonicalKpis(snapshot.orders, snapshot.inventory, options),
  };
}
