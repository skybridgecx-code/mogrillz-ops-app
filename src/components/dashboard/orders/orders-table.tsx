import type { Order } from "@/types/domain";

function shortOrderNumber(orderNumber: string) {
  const value = orderNumber.toUpperCase();
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function getFulfillmentLabel() {
  return "Next-day pickup";
}

function getFulfillmentWindowCopy(order: Order) {
  const normalized = order.serviceWindow
    .replace(/delivery timing confirmed after checkout/gi, "Pickup details confirmed after checkout")
    .replace(/delivery details confirmed after checkout/gi, "Pickup details confirmed after checkout")
    .replace(/^delivery\s*:\s*/i, "Pickup: ");

  return normalized.trim() || "Pickup details confirmed after checkout";
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
  return (
    <div className="table-wrap">
      <table className="ops-table">
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
          {orders.map((order) => (
            <tr
              className={order.id === selectedOrderId ? "is-selected" : ""}
              key={order.id}
              onClick={() => onSelectOrder(order.id)}
            >
              <td>
                <div className="row-name">
                  <strong title={order.orderNumber.toUpperCase()}>{shortOrderNumber(order.orderNumber)}</strong>
                  <span className="row-subtle">{order.paymentProvider} checkout</span>
                </div>
              </td>
              <td>
                <div className="row-name">
                  <strong>{order.customerName}</strong>
                  <span className="row-subtle">{order.customerZone}</span>
                </div>
              </td>
              <td>{order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}</td>
              <td>
                <div>{getFulfillmentLabel()}</div>
                <span className="row-subtle">{getFulfillmentWindowCopy(order)}</span>
              </td>
              <td><span className={`status-pill ${statusTone(order.status)}`}>{order.status}</span></td>
              <td>{formatCurrency(order.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
