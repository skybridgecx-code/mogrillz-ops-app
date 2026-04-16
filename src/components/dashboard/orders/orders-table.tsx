import type { Order } from "@/types/domain";

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
                  <strong>{order.orderNumber.toUpperCase()}</strong>
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
                <div>{order.fulfillmentMethod === "pickup" ? "Pickup" : "Delivery"}</div>
                <span className="row-subtle">{order.serviceWindow}</span>
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
