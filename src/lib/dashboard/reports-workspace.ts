// @ts-expect-error The native Node test runner resolves this explicit TypeScript extension.
import { isRecognizedPaidOrder, normalizePaymentStatus } from "./metrics.ts";
import type { Customer, Order } from "../../types/domain.ts";

export const REPORTS_TIME_ZONE = "America/New_York";
export const RECOGNIZED_REVENUE_DISCLOSURE =
  "Recognized revenue is associated with the order-created date because an authoritative paid-at timestamp is not available in the loaded model.";
export const LOADED_SNAPSHOT_DISCLOSURE =
  "This report covers the currently loaded dashboard snapshot. The current data loader does not paginate or retrieve source totals, so complete business-history coverage has not been verified.";

export type ReportRangeMode = "last-7" | "last-30" | "all-loaded";
export type PaymentExceptionKey =
  | "pending-unpaid"
  | "failed"
  | "refunded"
  | "unknown"
  | "cancelled-recognized";

export interface ReportRange {
  mode: ReportRangeMode;
  anchorDate: string | null;
  startDate: string | null;
  endDate: string | null;
  visibleLabel: string;
  bounded: boolean;
  dateKeys: string[];
  observedStartDate: string | null;
  observedEndDate: string | null;
}

export interface PaymentExceptionSummary {
  key: PaymentExceptionKey;
  label: string;
  count: number;
  totalCents: number;
}

export interface ItemRankingRow {
  identityKey: string;
  displayName: string;
  quantity: number;
  recognizedOrderCount: number;
  identitySource: "ID-backed" | "unlinked label";
}

export interface LifecycleMetric {
  key: "created-prep" | "prep-ready" | "ready-picked-up" | "created-picked-up";
  label: string;
  averageMinutes: number | null;
  sampleCount: number;
  missingCount: number;
  invalidCount: number;
}

export interface DailyMoneyRow {
  dateKey: string;
  valueCents: number;
}

export interface DailyCountRow {
  dateKey: string;
  count: number;
}

export interface ReportsWorkspaceInput {
  generatedAt: string;
  orders: readonly Order[];
  customers: readonly Customer[];
  rangeMode: ReportRangeMode;
}

export interface ReportsWorkspaceModel {
  range: ReportRange;
  generatedAt: string;
  recognizedRevenueCents: number;
  recognizedPaidOrderCount: number;
  averageRecognizedOrderCents: number | null;
  paymentExceptions: PaymentExceptionSummary[];
  scheduledServiceOrderCount: number;
  pickupCount: number;
  deliveryCount: number;
  linkedCustomerCount: number;
  repeatLinkedCustomerCount: number;
  repeatRatePercent: number | null;
  unlinkedRecognizedOrderCount: number;
  missingLoadedCustomerReferenceCount: number;
  itemRanking: ItemRankingRow[];
  lifecycle: LifecycleMetric[];
  dailyRecognizedRevenue: DailyMoneyRow[];
  dailyRecognizedOrders: DailyCountRow[];
  dailyScheduledServiceOrders: DailyCountRow[];
  coverage: {
    loadedOrderCount: number;
    loadedCustomerCount: number;
    selectedFinancialOrderCount: number;
    recognizedPaidOrderCount: number;
    scheduledServiceOrderCount: number;
    missingServiceDateCount: number;
    invalidCreatedAtCount: number;
    unlinkedRecognizedOrderCount: number;
    missingLoadedCustomerReferenceCount: number;
  };
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PENDING_UNPAID = new Set([
  "pending",
  "unpaid",
  "payment_pending",
  "requires_payment_method",
  "requires_action",
  "processing",
]);
const FAILED = new Set(["failed", "payment_failed", "declined", "canceled_by_provider"]);
const REFUNDED = new Set(["refunded", "partially_refunded", "partial_refund"]);

function compareText(left: string, right: string) {
  const a = left.trim().toLocaleLowerCase();
  const b = right.trim().toLocaleLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function displayLabel(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ") || "Unknown item";
}

export function getEasternDateKey(value: string | number | Date): string | null {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORTS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function isValidDateKey(value: string | null | undefined): value is string {
  if (!value || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function shiftDateKey(dateKey: string, offsetDays: number) {
  if (!isValidDateKey(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return shifted.toISOString().slice(0, 10);
}

export function enumerateDateKeys(startDate: string, endDate: string) {
  if (!isValidDateKey(startDate) || !isValidDateKey(endDate) || startDate > endDate) return [];
  const keys: string[] = [];
  for (let cursor: string | null = startDate; cursor && cursor <= endDate; cursor = shiftDateKey(cursor, 1)) {
    keys.push(cursor);
  }
  return keys;
}

function formatRangeLabel(startDate: string | null, endDate: string | null, allLoaded: boolean) {
  if (!startDate || !endDate) return allLoaded ? "All loaded data · observed dates unavailable" : "Date range unavailable";
  return allLoaded
    ? `All loaded data · observed ${startDate} through ${endDate}`
    : `${startDate} through ${endDate}`;
}

export function resolveReportRange(
  generatedAt: string,
  mode: ReportRangeMode,
  orders: readonly Pick<Order, "createdAt">[],
): ReportRange {
  const anchorDate = getEasternDateKey(generatedAt);
  const observedKeys = orders
    .map((order) => getEasternDateKey(order.createdAt))
    .filter((key): key is string => Boolean(key))
    .sort();
  const observedStartDate = observedKeys[0] ?? null;
  const observedEndDate = observedKeys.at(-1) ?? null;

  if (mode === "all-loaded") {
    return {
      mode,
      anchorDate,
      startDate: observedStartDate,
      endDate: observedEndDate,
      visibleLabel: formatRangeLabel(observedStartDate, observedEndDate, true),
      bounded: false,
      dateKeys:
        observedStartDate && observedEndDate
          ? enumerateDateKeys(observedStartDate, observedEndDate)
          : [],
      observedStartDate,
      observedEndDate,
    };
  }

  const days = mode === "last-7" ? 7 : 30;
  const startDate = anchorDate ? shiftDateKey(anchorDate, -(days - 1)) : null;
  const dateKeys = startDate && anchorDate ? enumerateDateKeys(startDate, anchorDate) : [];
  return {
    mode,
    anchorDate,
    startDate,
    endDate: anchorDate,
    visibleLabel: formatRangeLabel(startDate, anchorDate, false),
    bounded: true,
    dateKeys,
    observedStartDate,
    observedEndDate,
  };
}

function dateKeyInRange(dateKey: string | null, range: ReportRange) {
  if (!range.bounded) return true;
  return Boolean(dateKey && range.startDate && range.endDate && dateKey >= range.startDate && dateKey <= range.endDate);
}

function selectFinancialOrders(orders: readonly Order[], range: ReportRange) {
  if (!range.bounded) return [...orders];
  return orders.filter((order) => dateKeyInRange(getEasternDateKey(order.createdAt), range));
}

function validServiceDate(order: Order) {
  return isValidDateKey(order.serviceDate) ? order.serviceDate : null;
}

function selectServiceOrders(orders: readonly Order[], range: ReportRange) {
  return orders.filter((order) => {
    const dateKey = validServiceDate(order);
    return dateKey !== null && dateKeyInRange(dateKey, range);
  });
}

export function classifyPaymentExceptions(orders: readonly Order[]): PaymentExceptionSummary[] {
  const summaries: Record<PaymentExceptionKey, PaymentExceptionSummary> = {
    "pending-unpaid": { key: "pending-unpaid", label: "Pending or unpaid", count: 0, totalCents: 0 },
    failed: { key: "failed", label: "Failed", count: 0, totalCents: 0 },
    refunded: { key: "refunded", label: "Refunded", count: 0, totalCents: 0 },
    unknown: { key: "unknown", label: "Unknown", count: 0, totalCents: 0 },
    "cancelled-recognized": {
      key: "cancelled-recognized",
      label: "Cancelled with recognized-paid status",
      count: 0,
      totalCents: 0,
    },
  };

  for (const order of orders) {
    const normalized = normalizePaymentStatus(order.paymentStatus ?? "");
    let key: PaymentExceptionKey | null = null;
    if (order.status === "Cancelled" && ["paid", "captured", "succeeded"].includes(normalized)) {
      key = "cancelled-recognized";
    } else if (PENDING_UNPAID.has(normalized)) {
      key = "pending-unpaid";
    } else if (FAILED.has(normalized)) {
      key = "failed";
    } else if (REFUNDED.has(normalized)) {
      key = "refunded";
    } else if (!isRecognizedPaidOrder(order)) {
      key = "unknown";
    }

    if (!key) continue;
    summaries[key].count += 1;
    summaries[key].totalCents += Number.isFinite(order.totalCents) ? order.totalCents : 0;
  }

  return [
    summaries["pending-unpaid"],
    summaries.failed,
    summaries.refunded,
    summaries.unknown,
    summaries["cancelled-recognized"],
  ];
}

export function buildLinkedCustomerMetrics(
  recognizedOrders: readonly Order[],
  customers: readonly Customer[],
) {
  const counts = new Map<string, number>();
  let unlinkedRecognizedOrderCount = 0;

  for (const order of recognizedOrders) {
    const customerId = order.customerId;
    if (!customerId || !customerId.trim()) {
      unlinkedRecognizedOrderCount += 1;
      continue;
    }
    counts.set(customerId, (counts.get(customerId) ?? 0) + 1);
  }

  const loadedIds = new Set(customers.map((customer) => customer.id));
  const linkedCustomerCount = counts.size;
  const repeatLinkedCustomerCount = [...counts.values()].filter((count) => count >= 2).length;
  const missingLoadedCustomerReferenceCount = [...counts.keys()].filter((id) => !loadedIds.has(id)).length;

  return {
    linkedCustomerCount,
    repeatLinkedCustomerCount,
    repeatRatePercent: linkedCustomerCount
      ? Math.round((repeatLinkedCustomerCount / linkedCustomerCount) * 100)
      : null,
    unlinkedRecognizedOrderCount,
    missingLoadedCustomerReferenceCount,
  };
}

export function buildItemRanking(recognizedOrders: readonly Order[]): ItemRankingRow[] {
  const rows = new Map<
    string,
    { displayName: string; quantity: number; orderIds: Set<string>; identitySource: ItemRankingRow["identitySource"] }
  >();

  for (const order of recognizedOrders) {
    for (const item of order.items) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) continue;
      const hasId = Boolean(item.menuItemId && item.menuItemId.trim());
      const normalizedName = normalizeLabel(item.name) || "unknown item";
      const identityKey = hasId ? `id:${item.menuItemId}` : `label:${normalizedName}`;
      const existing = rows.get(identityKey) ?? {
        displayName: displayLabel(item.name),
        quantity: 0,
        orderIds: new Set<string>(),
        identitySource: hasId ? "ID-backed" : "unlinked label",
      };
      existing.quantity += item.quantity;
      existing.orderIds.add(order.id);
      rows.set(identityKey, existing);
    }
  }

  return [...rows.entries()]
    .map(([identityKey, row]) => ({
      identityKey,
      displayName: row.displayName,
      quantity: row.quantity,
      recognizedOrderCount: row.orderIds.size,
      identitySource: row.identitySource,
    }))
    .sort(
      (left, right) =>
        right.quantity - left.quantity ||
        right.recognizedOrderCount - left.recognizedOrderCount ||
        compareText(left.displayName, right.displayName) ||
        compareText(left.identityKey, right.identityKey),
    );
}

interface LifecycleDefinition {
  key: LifecycleMetric["key"];
  label: string;
  start: keyof Pick<Order, "createdAt" | "prepStartedAt" | "readyAt">;
  end: keyof Pick<Order, "prepStartedAt" | "readyAt" | "pickedUpAt">;
}

const LIFECYCLE_DEFINITIONS: LifecycleDefinition[] = [
  { key: "created-prep", label: "Created → Prep started", start: "createdAt", end: "prepStartedAt" },
  { key: "prep-ready", label: "Prep started → Ready", start: "prepStartedAt", end: "readyAt" },
  { key: "ready-picked-up", label: "Ready → Picked up", start: "readyAt", end: "pickedUpAt" },
  { key: "created-picked-up", label: "Created → Picked up", start: "createdAt", end: "pickedUpAt" },
];

export function buildLifecycleMetrics(orders: readonly Order[]): LifecycleMetric[] {
  return LIFECYCLE_DEFINITIONS.map((definition) => {
    const samples: number[] = [];
    let missingCount = 0;
    let invalidCount = 0;

    for (const order of orders) {
      const startValue = order[definition.start];
      const endValue = order[definition.end];
      if (!startValue || !endValue) {
        missingCount += 1;
        continue;
      }
      const start = Date.parse(startValue);
      const end = Date.parse(endValue);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        invalidCount += 1;
        continue;
      }
      samples.push((end - start) / 60000);
    }

    return {
      key: definition.key,
      label: definition.label,
      averageMinutes: samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : null,
      sampleCount: samples.length,
      missingCount,
      invalidCount,
    };
  });
}

function seriesKeysForBasis(range: ReportRange, observedKeys: string[]) {
  if (range.bounded) return [...range.dateKeys];
  const sorted = [...observedKeys].sort();
  const start = sorted[0];
  const end = sorted.at(-1);
  return start && end ? enumerateDateKeys(start, end) : [];
}

export function buildDailyRecognizedSeries(
  recognizedOrders: readonly Order[],
  range: ReportRange,
) {
  const validRows = recognizedOrders
    .map((order) => ({ order, dateKey: getEasternDateKey(order.createdAt) }))
    .filter((row): row is { order: Order; dateKey: string } => Boolean(row.dateKey));
  const keys = seriesKeysForBasis(range, validRows.map((row) => row.dateKey));
  const revenue = new Map(keys.map((dateKey) => [dateKey, 0]));
  const counts = new Map(keys.map((dateKey) => [dateKey, 0]));

  for (const { order, dateKey } of validRows) {
    if (!revenue.has(dateKey)) continue;
    revenue.set(dateKey, (revenue.get(dateKey) ?? 0) + order.totalCents);
    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
  }

  return {
    revenue: keys.map((dateKey) => ({ dateKey, valueCents: revenue.get(dateKey) ?? 0 })),
    orders: keys.map((dateKey) => ({ dateKey, count: counts.get(dateKey) ?? 0 })),
  };
}

export function buildDailyServiceSeries(orders: readonly Order[], range: ReportRange) {
  const validRows = orders
    .map((order) => ({ order, dateKey: validServiceDate(order) }))
    .filter((row): row is { order: Order; dateKey: string } => Boolean(row.dateKey));
  const keys = seriesKeysForBasis(range, validRows.map((row) => row.dateKey));
  const counts = new Map(keys.map((dateKey) => [dateKey, 0]));
  for (const { dateKey } of validRows) {
    if (counts.has(dateKey)) counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
  }
  return keys.map((dateKey) => ({ dateKey, count: counts.get(dateKey) ?? 0 }));
}

export function buildReportsWorkspace(input: ReportsWorkspaceInput): ReportsWorkspaceModel {
  const orders = [...input.orders];
  const customers = [...input.customers];
  const range = resolveReportRange(input.generatedAt, input.rangeMode, orders);
  const financialOrders = selectFinancialOrders(orders, range);
  const recognizedOrders = financialOrders.filter(isRecognizedPaidOrder);
  const recognizedRevenueCents = recognizedOrders.reduce(
    (sum, order) => sum + (Number.isFinite(order.totalCents) ? order.totalCents : 0),
    0,
  );
  const serviceDateOrders = selectServiceOrders(orders, range);
  const scheduledServiceOrders = serviceDateOrders.filter((order) => order.status !== "Cancelled");
  const customerMetrics = buildLinkedCustomerMetrics(recognizedOrders, customers);
  const lifecycle = buildLifecycleMetrics(scheduledServiceOrders);
  const dailyFinancial = buildDailyRecognizedSeries(recognizedOrders, range);

  return {
    range,
    generatedAt: input.generatedAt,
    recognizedRevenueCents,
    recognizedPaidOrderCount: recognizedOrders.length,
    averageRecognizedOrderCents: recognizedOrders.length
      ? recognizedRevenueCents / recognizedOrders.length
      : null,
    paymentExceptions: classifyPaymentExceptions(financialOrders),
    scheduledServiceOrderCount: scheduledServiceOrders.length,
    pickupCount: scheduledServiceOrders.filter((order) => order.fulfillmentMethod === "pickup").length,
    deliveryCount: scheduledServiceOrders.filter((order) => order.fulfillmentMethod === "delivery").length,
    ...customerMetrics,
    itemRanking: buildItemRanking(recognizedOrders),
    lifecycle,
    dailyRecognizedRevenue: dailyFinancial.revenue,
    dailyRecognizedOrders: dailyFinancial.orders,
    dailyScheduledServiceOrders: buildDailyServiceSeries(scheduledServiceOrders, range),
    coverage: {
      loadedOrderCount: orders.length,
      loadedCustomerCount: customers.length,
      selectedFinancialOrderCount: financialOrders.length,
      recognizedPaidOrderCount: recognizedOrders.length,
      scheduledServiceOrderCount: scheduledServiceOrders.length,
      missingServiceDateCount: orders.filter((order) => !validServiceDate(order)).length,
      invalidCreatedAtCount: orders.filter((order) => !getEasternDateKey(order.createdAt)).length,
      unlinkedRecognizedOrderCount: customerMetrics.unlinkedRecognizedOrderCount,
      missingLoadedCustomerReferenceCount: customerMetrics.missingLoadedCustomerReferenceCount,
    },
  };
}
