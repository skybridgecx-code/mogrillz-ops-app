import type { Order } from "@/types/domain";

export type OrderFilter = "all" | "new" | "in prep" | "ready" | "picked up";
export type FulfillmentFilter = "all" | "delivery" | "pickup";

interface OrderFiltersProps {
  orders: Order[];
  orderFilter: OrderFilter;
  fulfillmentFilter: FulfillmentFilter;
  orderFilters: OrderFilter[];
  fulfillmentFilters: FulfillmentFilter[];
  onOrderFilterChange: (filter: OrderFilter) => void;
  onFulfillmentFilterChange: (filter: FulfillmentFilter) => void;
}

export function OrderFilters({
  orders,
  orderFilter,
  fulfillmentFilter,
  orderFilters,
  fulfillmentFilters,
  onOrderFilterChange,
  onFulfillmentFilterChange,
}: OrderFiltersProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "flex-end" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end" }}>
        <span className="card-kicker" style={{ margin: 0 }}>
          Status
        </span>
        <div className="filter-row">
          {orderFilters.map((filter) => {
            const count =
              filter === "all"
                ? orders.length
                : orders.filter((order) => order.status.toLowerCase() === filter).length;
            return (
              <button
                className={`filter-chip ${orderFilter === filter ? "is-active" : ""}`}
                key={filter}
                onClick={() => onOrderFilterChange(filter)}
                type="button"
              >
                {filter} ({count})
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end" }}>
        <span className="card-kicker" style={{ margin: 0 }}>
          Fulfillment
        </span>
        <div className="filter-row">
          {fulfillmentFilters.map((filter) => {
            const count =
              filter === "all"
                ? orders.length
                : orders.filter((order) => order.fulfillmentMethod === filter).length;
            return (
              <button
                className={`filter-chip ${fulfillmentFilter === filter ? "is-active" : ""}`}
                key={filter}
                onClick={() => onFulfillmentFilterChange(filter)}
                type="button"
              >
                {filter} ({count})
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
