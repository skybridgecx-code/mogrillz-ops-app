import type { Order, OrderStatus } from "@/types/domain";

export type OrderWorkspaceFilter = "all" | "active" | "New" | "In Prep" | "Ready" | "Picked Up";

export interface OrderWorkspaceQuery {
  filter: OrderWorkspaceFilter;
  search: string;
}

export interface OrderWorkspaceCounts {
  all: number;
  active: number;
  New: number;
  "In Prep": number;
  Ready: number;
  "Picked Up": number;
  Cancelled: number;
}

const ACTIVE_STATUSES = new Set<OrderStatus>(["New", "In Prep", "Ready"]);

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

export function getOrderWorkspaceCounts(orders: Order[]): OrderWorkspaceCounts {
  const counts: OrderWorkspaceCounts = {
    all: 0,
    active: 0,
    New: 0,
    "In Prep": 0,
    Ready: 0,
    "Picked Up": 0,
    Cancelled: 0,
  };

  for (const order of orders) {
    counts[order.status] += 1;
    if (order.status !== "Cancelled") counts.all += 1;
    if (ACTIVE_STATUSES.has(order.status)) counts.active += 1;
  }

  return counts;
}

export function orderMatchesSearch(order: Order, search: string) {
  const query = normalize(search);
  if (!query) return true;

  const searchable = [
    order.orderNumber,
    order.customerName,
    order.customerEmail,
    order.customerZone,
    order.fulfillmentMethod,
    order.serviceDate,
    order.serviceWindow,
    order.paymentProvider,
    order.paymentStatus,
    order.customRequest,
    order.operatorNote,
    ...order.items.flatMap((item) => [item.name, item.notes]),
  ]
    .map(normalize)
    .join("\n");

  return searchable.includes(query);
}

export function orderMatchesFilter(order: Order, filter: OrderWorkspaceFilter) {
  if (order.status === "Cancelled") return false;
  if (filter === "all") return true;
  if (filter === "active") return ACTIVE_STATUSES.has(order.status);
  return order.status === filter;
}

export function filterOrderWorkspace(orders: Order[], query: OrderWorkspaceQuery) {
  return orders.filter(
    (order) => orderMatchesFilter(order, query.filter) && orderMatchesSearch(order, query.search),
  );
}

export function getOrderItemCount(order: Order) {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}
