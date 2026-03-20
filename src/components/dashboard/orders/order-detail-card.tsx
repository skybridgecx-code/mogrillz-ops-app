import type { Order } from "@/types/domain";
import { getNextOrderStatus, getOrderStatusActionLabel } from "@/lib/dashboard/order-status";

interface OrderDetailCardProps {
  selectedOrder: Order | null;
  onOpenInventory: () => void;
  onOpenCustomer: () => void;
  onAdvanceStatus: (orderId: string, nextStatus: Order["status"]) => Promise<void>;
  statusError: string | null;
  statusUpdating: boolean;
  formatCurrency: (cents: number) => string;
}

export function OrderDetailCard({
  selectedOrder,
  onOpenInventory,
  onOpenCustomer,
  onAdvanceStatus,
  statusError,
  statusUpdating,
  formatCurrency,
}: OrderDetailCardProps) {
  const nextStatus = selectedOrder ? getNextOrderStatus(selectedOrder.status) : null;
  const nextActionLabel = selectedOrder ? getOrderStatusActionLabel(selectedOrder.status) : null;

  return (
    <aside className="detail-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">Selected Order</p>
          <h2 className="card-title">{selectedOrder ? `${selectedOrder.orderNumber.toUpperCase()} · ${selectedOrder.customerName}` : "No order selected"}</h2>
        </div>
      </div>

      {selectedOrder ? (
        <div className="detail-panel">
          <div className="detail-hero">
            <h3>{selectedOrder.status}</h3>
            <p>
              {selectedOrder.fulfillmentMethod === "pickup"
                ? `Pickup. ${selectedOrder.deliveryWindow}. Total ${formatCurrency(selectedOrder.totalCents)}.`
                : `Delivery. ${selectedOrder.deliveryWindow}. Zone: ${selectedOrder.customerZone}. Total ${formatCurrency(selectedOrder.totalCents)}.`}
            </p>
          </div>
          <div className="detail-note">
            <strong>Custom request</strong>
            {selectedOrder.customRequest ?? "No custom request on this order."}
          </div>
          <div className="detail-list">
            {selectedOrder.items.map((item) => (
              <div className="detail-list-item" key={item.id}>
                <span>
                  <strong>{item.quantity}x {item.name}</strong>
                  {item.notes ? <><br />{item.notes}</> : null}
                </span>
                <span>{item.notes ? "Customized" : "Standard"}</span>
              </div>
            ))}
          </div>
          <div className="timeline">
            {["Placed", "Packed", selectedOrder.status].map((step, index) => (
              <div className="timeline-item done" key={`${selectedOrder.id}-${step}-${index}`}>
                <div className="timeline-dot" />
                <div className="timeline-copy">
                  <strong>{step}</strong>
                  <span>{index === 2 ? "Most recent queue state." : "Completed stage in the flow."}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="detail-actions">
            {selectedOrder && nextStatus && nextActionLabel ? (
              <button
                className="topbar-action"
                disabled={statusUpdating}
                onClick={() => onAdvanceStatus(selectedOrder.id, nextStatus)}
                type="button"
              >
                {statusUpdating ? "Updating..." : nextActionLabel}
              </button>
            ) : null}
            <button className="topbar-action" onClick={onOpenInventory} type="button">Check stock</button>
            <button className="ghost-button" onClick={onOpenCustomer} type="button">Open customer</button>
          </div>
          {statusError ? (
            <div className="stack-item-meta" style={{ color: "#D27A62", marginTop: "0.75rem" }}>
              {statusError}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="detail-panel">
          <div className="detail-hero">
            <h3>No order selected</h3>
            <p>Adjust or reset filters to view an order.</p>
          </div>
          <div className="detail-note">
            <strong>Orders detail</strong>
            When a matching order is available, its fulfillment details, custom request, and item breakdown will appear here.
          </div>
        </div>
      )}
    </aside>
  );
}
