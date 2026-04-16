import type { Order } from "@/types/domain";

import { FulfillmentFilter, OrderFilter, OrderFilters } from "@/components/dashboard/orders/order-filters";
import { OrderDetailCard } from "@/components/dashboard/orders/order-detail-card";
import { OrdersEmptyState } from "@/components/dashboard/orders/orders-empty-state";
import { OrdersTable } from "@/components/dashboard/orders/orders-table";

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
  return (
    <section className="view-panel active">
      <div className="content-grid">
        <article className="card card-span-2">
          <div className="card-head">
            <div>
              <p className="card-kicker">Orders</p>
              <h2 className="card-title">Live queue</h2>
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
              fontSize: "0.9rem",
            }}
          >
            <span>{filteredOrders.length} matching orders</span>
            <span>Showing {fulfillmentFilter === "all" ? "pickup orders" : fulfillmentFilter}</span>
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
