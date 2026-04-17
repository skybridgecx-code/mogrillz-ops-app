import type { Order } from "@/types/domain";
import { getOrderStatusDisplayLabel, getPickupTimingBucket, getPickupTimingLabel } from "@/lib/dashboard/order-status";

function shortOrderNumber(orderNumber: string) {
  const value = orderNumber.toUpperCase();
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function getFulfillmentLabel() {
  return "Next-day pickup";
}

function isPendingOrder(order: Order) {
  return order.status === "New" || order.status === "In Prep" || order.status === "Ready";
}

function isInactiveOrder(order: Order) {
  return order.status === "Picked Up" || order.status === "Cancelled";
}

function getFulfillmentWindowCopy(order: Order) {
  const normalized = order.serviceWindow
    .replace(/delivery timing confirmed after checkout/gi, "Pickup details confirmed after checkout")
    .replace(/delivery details confirmed after checkout/gi, "Pickup details confirmed after checkout")
    .replace(/^delivery\s*:\s*/i, "Pickup: ");

  return normalized.trim() || "Pickup details confirmed after checkout";
}

function getQueueStatusCopy(status: Order["status"]) {
  switch (status) {
    case "New":
      return "Needs review";
    case "In Prep":
      return "Kitchen active";
    case "Ready":
      return "Awaiting pickup";
    case "Picked Up":
      return "Completed";
    case "Cancelled":
      return "Not fulfilled";
    default:
      return status;
  }
}

function formatOrderItemsForRow(order: Order) {
  if (!order.items.length) return "No items captured";
  const preview = order.items
    .slice(0, 2)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ");

  if (order.items.length <= 2) return preview;
  return `${preview} +${order.items.length - 2} more`;
}

interface OrdersTableProps {
  orders: Order[];
  selectedOrderId: string;
  onSelectOrder: (id: string) => void;
  formatCurrency: (cents: number) => string;
  statusTone: (status: string) => string;
}

export function OrdersTable({
  orders,
  selectedOrderId,
  onSelectOrder,
  formatCurrency,
  statusTone,
}: OrdersTableProps) {
  const newestOrderId = orders.reduce<{ id: string; ts: number } | null>((current, order) => {
    const timestamp = Number.isFinite(new Date(order.createdAt).getTime()) ? new Date(order.createdAt).getTime() : 0;
    if (!current || timestamp > current.ts) {
      return { id: order.id, ts: timestamp };
    }
    return current;
  }, null)?.id ?? "";

  return (
    <div className="table-wrap">
      <table className="ops-table ops-table-orders">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Fulfillment</th>
            <th>Status</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const pending = isPendingOrder(order);
            const inactive = isInactiveOrder(order);
            const pickupTimingBucket = getPickupTimingBucket(order.serviceDate);
            const pickupTimingLabel = getPickupTimingLabel(order.serviceDate);
            const dueToday = pending && pickupTimingBucket === "today";
            const dueTomorrow = pending && pickupTimingBucket === "tomorrow";

            return (
              <tr
                className={[
                  order.id === selectedOrderId ? "is-selected" : "",
                  pending ? "is-pending" : "",
                  order.id === newestOrderId ? "is-newest" : "",
                  dueToday ? "is-due-today" : "",
                  dueTomorrow ? "is-due-tomorrow" : "",
                  inactive ? "is-inactive" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={order.id}
                onClick={() => onSelectOrder(order.id)}
              >
                <td>
                  <div className="row-name">
                    <strong title={order.orderNumber.toUpperCase()}>{shortOrderNumber(order.orderNumber)}</strong>
                    <span className="row-subtle row-subtle-stack">
                      <span>{order.paymentProvider} checkout</span>
                      <span className="queue-flag-row">
                        {order.id === newestOrderId ? <span className="queue-flag queue-flag-new">Newest</span> : null}
                        {pending ? <span className="queue-flag queue-flag-pending">Pending</span> : null}
                        {dueToday ? <span className="queue-flag queue-flag-due-today">Due today</span> : null}
                        {dueTomorrow ? <span className="queue-flag queue-flag-due-tomorrow">Due tomorrow</span> : null}
                      </span>
                    </span>
                  </div>
                </td>
                <td>
                  <div className="row-name">
                    <strong>{order.customerName}</strong>
                    <span className="row-subtle">{order.customerEmail || order.customerZone}</span>
                  </div>
                </td>
                <td>
                  <span title={order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}>
                    {formatOrderItemsForRow(order)}
                  </span>
                </td>
                <td>
                  <div>{getFulfillmentLabel()}</div>
                  <span className="row-subtle row-subtle-stack">
                    <span>{pickupTimingLabel}</span>
                    <span>{getFulfillmentWindowCopy(order)}</span>
                  </span>
                </td>
                <td>
                  <div className="row-name">
                    <span className={`status-pill ${statusTone(order.status)}`}>{getOrderStatusDisplayLabel(order.status)}</span>
                    <span className="row-subtle">{getQueueStatusCopy(order.status)}</span>
                  </div>
                </td>
                <td>{formatCurrency(order.totalCents)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
