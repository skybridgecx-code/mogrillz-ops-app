import type {
  Customer,
  EmailUpdate,
  Order,
  OrderStatus,
  OrderStatusEvent,
} from "@/types/domain";

export const ACTIVITY_SCOPE = "order-status-events-only" as const;

export type LoyaltyTier = Customer["loyaltyTier"];
export type CustomerSort = "loyalty" | "lifetime" | "name" | "direct-orders";
export type SubscriberSort = "recent" | "email" | "status";

export interface CustomerDirectoryFilters {
  search: string;
  loyaltyTier: LoyaltyTier | "all";
  zone: string;
  sort: CustomerSort;
}

export interface CustomerSummaryMismatch {
  totalOrders: boolean;
  lifetimeValueCents: boolean;
}

export interface CustomerDirectoryRow {
  customer: Customer;
  directOrders: Order[];
  possibleEmailMatches: Order[];
  storedSummaryMismatch: CustomerSummaryMismatch;
}

export interface SubscriberAvailability {
  status: "loaded" | "unavailable";
  issue?: string | null;
}

export interface ActivityFilters {
  search: string;
  status: OrderStatus | "all";
}

export type ActivityActorState = "recorded" | "unavailable";

export interface EnrichedActivityEvent {
  event: OrderStatusEvent;
  order: Order | null;
  customer: Customer | null;
  actorState: ActivityActorState;
}

export type WorkspaceCompleteness = "complete" | "degraded" | "empty" | "unavailable";

export interface WorkspaceCompletenessInput {
  customerCount: number;
  subscriberAvailability: SubscriberAvailability;
  activityAvailability: SubscriberAvailability;
  activityCount: number;
}

const LOYALTY_PRIORITY: Record<LoyaltyTier, number> = {
  VIP: 0,
  High: 1,
  Rising: 2,
  Early: 3,
};

const STATUS_PRIORITY: Record<OrderStatus, number> = {
  New: 0,
  "In Prep": 1,
  Ready: 2,
  "Picked Up": 3,
  Cancelled: 4,
};

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeCustomerSearch(value: string) {
  return normalized(value);
}

export function normalizeCustomerEmail(value: string | null | undefined) {
  return normalized(value);
}

export function normalizeLoyaltyTier(value: unknown): LoyaltyTier {
  const raw = normalized(typeof value === "string" ? value : "");
  if (raw === "vip") return "VIP";
  if (raw === "high") return "High";
  if (raw === "rising") return "Rising";
  if (raw === "early" || raw === "new") return "Early";
  return "Early";
}

function compareText(left: string, right: string) {
  const a = normalized(left);
  const b = normalized(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareDateDescending(left: string, right: string) {
  const leftTimestamp = Date.parse(left);
  const rightTimestamp = Date.parse(right);
  const safeLeft = Number.isFinite(leftTimestamp) ? leftTimestamp : Number.NEGATIVE_INFINITY;
  const safeRight = Number.isFinite(rightTimestamp) ? rightTimestamp : Number.NEGATIVE_INFINITY;
  return safeRight - safeLeft;
}

export function customerMatchesSearch(customer: Customer, search: string) {
  const query = normalizeCustomerSearch(search);
  if (!query) return true;

  return [customer.name, customer.email, customer.zone, customer.loyaltyTier, customer.notes]
    .some((field) => normalized(field).includes(query));
}

export function associateCustomerOrders(customer: Customer, orders: Order[]) {
  const directOrders = orders.filter((order) => order.customerId === customer.id);
  const possibleEmailMatches = orders.filter(
    (order) =>
      order.customerId === null &&
      Boolean(normalizeCustomerEmail(order.customerEmail)) &&
      normalizeCustomerEmail(order.customerEmail) === normalizeCustomerEmail(customer.email),
  );
  return { directOrders, possibleEmailMatches };
}

export function getStoredSummaryMismatch(customer: Customer, directOrders: Order[]): CustomerSummaryMismatch {
  const directValueCents = directOrders.reduce((total, order) => total + order.totalCents, 0);
  return {
    totalOrders: customer.totalOrders !== directOrders.length,
    lifetimeValueCents: customer.lifetimeValueCents !== directValueCents,
  };
}

export function buildCustomerDirectoryRows(customers: Customer[], orders: Order[]) {
  return customers.map((customer): CustomerDirectoryRow => {
    const { directOrders, possibleEmailMatches } = associateCustomerOrders(customer, orders);
    return {
      customer,
      directOrders,
      possibleEmailMatches,
      storedSummaryMismatch: getStoredSummaryMismatch(customer, directOrders),
    };
  });
}

export function sortCustomerDirectory(rows: CustomerDirectoryRow[], sort: CustomerSort = "loyalty") {
  return [...rows].sort((left, right) => {
    let result = 0;
    if (sort === "lifetime") result = right.customer.lifetimeValueCents - left.customer.lifetimeValueCents;
    if (sort === "name") result = compareText(left.customer.name, right.customer.name);
    if (sort === "direct-orders") result = right.directOrders.length - left.directOrders.length;
    if (sort === "loyalty") result = LOYALTY_PRIORITY[left.customer.loyaltyTier] - LOYALTY_PRIORITY[right.customer.loyaltyTier];
    if (result !== 0) return result;

    result = right.customer.lifetimeValueCents - left.customer.lifetimeValueCents;
    if (result !== 0) return result;
    result = compareText(left.customer.name, right.customer.name);
    return result !== 0 ? result : compareText(left.customer.id, right.customer.id);
  });
}

export function filterCustomerDirectory(
  rows: CustomerDirectoryRow[],
  filters: CustomerDirectoryFilters,
) {
  const filtered = rows.filter(({ customer }) => {
    const matchesTier = filters.loyaltyTier === "all" || customer.loyaltyTier === filters.loyaltyTier;
    const matchesZone = filters.zone === "all" || customer.zone === filters.zone;
    return matchesTier && matchesZone && customerMatchesSearch(customer, filters.search);
  });
  return sortCustomerDirectory(filtered, filters.sort);
}

export function deriveCustomerZones(customers: Customer[]) {
  return [...new Set(customers.map((customer) => customer.zone.trim()).filter(Boolean))]
    .sort((left, right) => compareText(left, right));
}

export function getCustomerSummaryCounts(rows: CustomerDirectoryRow[]) {
  return {
    storedCustomers: rows.length,
    vipRecords: rows.filter(({ customer }) => customer.loyaltyTier === "VIP").length,
    directlyLinkedOrders: rows.reduce((total, row) => total + row.directOrders.length, 0),
    unlinkedEmailMatchCandidates: rows.reduce((total, row) => total + row.possibleEmailMatches.length, 0),
  };
}

export function classifySubscriberStatus(update: EmailUpdate) {
  return update.status === "Active" ? "active" : "unsubscribed";
}

export function sortSubscribers(updates: EmailUpdate[], sort: SubscriberSort = "recent") {
  return [...updates].sort((left, right) => {
    let result = 0;
    if (sort === "recent") result = compareDateDescending(left.lastRequestedAt, right.lastRequestedAt);
    if (sort === "email") result = compareText(left.email, right.email);
    if (sort === "status") result = compareText(classifySubscriberStatus(left), classifySubscriberStatus(right));
    if (result !== 0) return result;
    result = compareText(left.email, right.email);
    return result !== 0 ? result : compareText(left.id, right.id);
  });
}

function uniqueActivityEvents(events: OrderStatusEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

export function sortActivityEvents(events: OrderStatusEvent[]) {
  return uniqueActivityEvents(events).sort((left, right) => {
    const byDate = compareDateDescending(left.changedAt, right.changedAt);
    if (byDate !== 0) return byDate;
    const byVersion = right.orderVersion - left.orderVersion;
    if (byVersion !== 0) return byVersion;
    return compareText(left.id, right.id);
  });
}

export function enrichActivityEvents(
  events: OrderStatusEvent[],
  orders: Order[],
  customers: Customer[],
): EnrichedActivityEvent[] {
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  return sortActivityEvents(events).map((event) => {
    const order = ordersById.get(event.orderId) ?? null;
    const customer = order?.customerId ? customersById.get(order.customerId) ?? null : null;
    return {
      event,
      order,
      customer,
      actorState: event.changedBy ? "recorded" : "unavailable",
    };
  });
}

export function activityMatchesSearch(activity: EnrichedActivityEvent, search: string) {
  const query = normalizeCustomerSearch(search);
  if (!query) return true;
  const { event, order, customer } = activity;
  return [order?.orderNumber, customer?.name, event.fromStatus, event.toStatus]
    .some((field) => normalized(field).includes(query));
}

export function filterActivityWorkspace(
  activity: EnrichedActivityEvent[],
  filters: ActivityFilters,
) {
  return activity.filter((item) => {
    const { event } = item;
    const matchesStatus = filters.status === "all" || event.toStatus === filters.status;
    return matchesStatus && activityMatchesSearch(item, filters.search);
  });
}

export function getWorkspaceCompleteness(input: WorkspaceCompletenessInput): WorkspaceCompleteness {
  if (input.subscriberAvailability.status === "unavailable" || input.activityAvailability.status === "unavailable") {
    return "degraded";
  }
  if (input.customerCount === 0 && input.activityCount === 0) return "empty";
  return "complete";
}

export function getActivityStatusOptions() {
  return (Object.keys(STATUS_PRIORITY) as OrderStatus[]).sort(
    (left, right) => STATUS_PRIORITY[left] - STATUS_PRIORITY[right],
  );
}
