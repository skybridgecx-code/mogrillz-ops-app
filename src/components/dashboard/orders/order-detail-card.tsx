import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getNextOrderStatus, getOrderStatusActionLabel } from "@/lib/dashboard/order-status";
import type { Order } from "@/types/domain";

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
  const router = useRouter();
  const nextStatus = selectedOrder ? getNextOrderStatus(selectedOrder.status) : null;
  const nextActionLabel = selectedOrder ? getOrderStatusActionLabel(selectedOrder.status) : null;
  const [noteDraft, setNoteDraft] = useState(selectedOrder?.operatorNote ?? "");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    setNoteDraft(selectedOrder?.operatorNote ?? "");
    setNoteError(null);
    setNoteSaving(false);
  }, [selectedOrder?.id, selectedOrder?.operatorNote]);

  async function handleSaveOperatorNote() {
    if (!selectedOrder) return;

    setNoteError(null);
    setNoteSaving(true);

    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}/note`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ operatorNote: noteDraft }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Unable to save the operator note.");
      }

      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save the operator note.";
      setNoteError(message);
    } finally {
      setNoteSaving(false);
    }
  }

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
                ? `Pickup. ${selectedOrder.serviceWindow}. Total ${formatCurrency(selectedOrder.totalCents)}.`
                : `Delivery. ${selectedOrder.serviceWindow}. Zone: ${selectedOrder.customerZone}. Total ${formatCurrency(selectedOrder.totalCents)}.`}
            </p>
          </div>
          <div className="detail-note">
            <strong>Custom request</strong>
            {selectedOrder.customRequest ?? "No custom request on this order."}
          </div>
          <div className="detail-note">
            <strong>Internal operator note</strong>
            <textarea
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Add internal context for prep, dispatch, or handoff."
              style={{
                width: "100%",
                minHeight: "108px",
                marginTop: "0.8rem",
                padding: "0.9rem 1rem",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)",
                color: "inherit",
                resize: "vertical",
              }}
              value={noteDraft}
            />
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
            <button
              className="ghost-button"
              disabled={noteSaving || noteDraft === (selectedOrder.operatorNote ?? "")}
              onClick={handleSaveOperatorNote}
              type="button"
            >
              {noteSaving ? "Saving note..." : "Save internal note"}
            </button>
          </div>
          {statusError ? (
            <div className="stack-item-meta" style={{ color: "#D27A62", marginTop: "0.75rem" }}>
              {statusError}
            </div>
          ) : null}
          {noteError ? (
            <div className="stack-item-meta" style={{ color: "#D27A62", marginTop: "0.75rem" }}>
              {noteError}
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
