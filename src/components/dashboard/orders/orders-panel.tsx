import type { Order } from "@/types/domain";

import { FulfillmentFilter, OrderFilter, OrderFilters } from "@/components/dashboard/orders/order-filters";
import { OrderDetailCard } from "@/components/dashboard/orders/order-detail-card";
import { OrdersEmptyState } from "@/components/dashboard/orders/orders-empty-state";
import { OrdersTable } from "@/components/dashboard/orders/orders-table";
import { getPickupTimingBucket } from "@/lib/dashboard/order-status";

function isActivePickupOrder(order: Order) {
  return (
    order.fulfillmentMethod === "pickup" &&
    (order.status === "New" || order.status === "In Prep" || order.status === "Ready")
  );
}

function buildPrepChecklist(activeOrders: Order[]) {
  const totalsByItemName = new Map<string, number>();

  for (const order of activeOrders) {
    for (const item of order.items) {
      const itemName = (item.name || "Unknown item").trim() || "Unknown item";
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
      totalsByItemName.set(itemName, (totalsByItemName.get(itemName) || 0) + quantity);
    }
  }

  return [...totalsByItemName.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((left, right) => {
      if (right.quantity !== left.quantity) return right.quantity - left.quantity;
      return left.name.localeCompare(right.name);
    });
}

interface OrdersPanelProps {
  orders: Order[];
  filteredOrders: Order[];
  selectedOrder: Order | null;
  selectedOrderId: string;
  orderFilter: OrderFilter;
  fulfillmentFilter: FulfillmentFilter;
  orderFilters: OrderFilter[];
  fulfillmentFilters: FulfillmentFilter[];
  onOrderFilterChange: (filter: OrderFilter) => void;
  onFulfillmentFilterChange: (filter: FulfillmentFilter) => void;
  onSelectOrder: (id: string) => void;
  onResetFilters: () => void;
  onOpenInventory: () => void;
  onOpenCustomer: () => void;
  onAdvanceStatus: (orderId: string, nextStatus: Order["status"]) => Promise<void>;
  statusError: string | null;
  statusUpdating: boolean;
  formatCurrency: (cents: number) => string;
  statusTone: (status: string) => string;
}

export function OrdersPanel({
  orders,
  filteredOrders,
  selectedOrder,
  selectedOrderId,
  orderFilter,
  fulfillmentFilter,
  orderFilters,
  fulfillmentFilters,
  onOrderFilterChange,
  onFulfillmentFilterChange,
  onSelectOrder,
  onResetFilters,
  onOpenInventory,
  onOpenCustomer,
  onAdvanceStatus,
  statusError,
  statusUpdating,
  formatCurrency,
  statusTone,
}: OrdersPanelProps) {
  const activeOrders = filteredOrders.filter((order) => isActivePickupOrder(order));
  const pendingCount = activeOrders.length;
  const dueTodayCount = activeOrders.filter((order) => getPickupTimingBucket(order.serviceDate) === "today").length;
  const dueTomorrowCount = activeOrders.filter((order) => getPickupTimingBucket(order.serviceDate) === "tomorrow").length;
  const prepChecklistOrders = orders.filter((order) => isActivePickupOrder(order));
  const prepChecklistItems = buildPrepChecklist(prepChecklistOrders);
  const prepChecklistTotalCount = prepChecklistItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="view-panel active">
      <div className="content-grid">
        <article className="card card-span-2">
          <div className="card-head">
            <div>
              <p className="card-kicker">Orders</p>
              <h2 className="card-title">Next-day pickup queue</h2>
            </div>
            <OrderFilters
              orders={orders}
              orderFilter={orderFilter}
              fulfillmentFilter={fulfillmentFilter}
              orderFilters={orderFilters}
              fulfillmentFilters={fulfillmentFilters}
              onOrderFilterChange={onOrderFilterChange}
              onFulfillmentFilterChange={onFulfillmentFilterChange}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              marginBottom: "1rem",
              color: "rgba(255,255,255,0.72)",
              fontSize: "0.84rem",
            }}
          >
            <span>
              {filteredOrders.length} matching orders · {pendingCount} pending pickup · {dueTodayCount} due today · {dueTomorrowCount} due tomorrow
            </span>
            <span>Showing {fulfillmentFilter === "all" ? "next-day pickup orders" : fulfillmentFilter}</span>
          </div>

          <div
            className="detail-note"
            style={{
              marginBottom: "1rem",
              padding: "0.85rem 1rem",
              display: "grid",
              gap: "0.65rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.8rem",
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "grid", gap: "0.2rem" }}>
                <strong>Prep checklist</strong>
                <span className="row-subtle">Based on active pickup orders</span>
              </div>
              {prepChecklistItems.length ? (
                <span className="row-subtle">
                  {prepChecklistOrders.length} active orders · {prepChecklistTotalCount} items
                </span>
              ) : null}
            </div>

            {prepChecklistItems.length ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: "0.5rem",
                }}
              >
                {prepChecklistItems.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                      padding: "0.55rem 0.65rem",
                      background: "rgba(255,255,255,0.02)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.6rem",
                    }}
                  >
                    <span>{item.name}</span>
                    <strong>{item.quantity}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <span className="row-subtle">No active pickup orders right now.</span>
            )}
          </div>

          {filteredOrders.length ? (
            <OrdersTable
              orders={filteredOrders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={onSelectOrder}
              formatCurrency={formatCurrency}
              statusTone={statusTone}
            />
          ) : (
            <OrdersEmptyState onReset={onResetFilters} />
          )}
        </article>

        <OrderDetailCard
          selectedOrder={selectedOrder}
          onOpenInventory={onOpenInventory}
          onOpenCustomer={onOpenCustomer}
          onAdvanceStatus={onAdvanceStatus}
          statusError={statusError}
          statusUpdating={statusUpdating}
          formatCurrency={formatCurrency}
        />
      </div>
    </section>
  );
}
