import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  canCancelOrderStatus,
  getNextOrderStatus,
  getOrderStatusActionLabel,
  getOrderStatusDisplayLabel,
  getPickupTimingBucket,
  getPickupTimingLabel,
  isRiskyOrderStatusTransition,
} from "@/lib/dashboard/order-status";
import type { Order } from "@/types/domain";

const DEFAULT_PICKUP_WINDOW_COPY = "Pickup details confirmed after checkout";

function shortOrderNumber(orderNumber: string) {
  const value = orderNumber.toUpperCase();
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function getCustomerRequestCopy(order: Order) {
  const request = order.customRequest?.trim();
  if (!request) return "No customer request on this order.";
  return request
    .replace(/^delivery\s*:\s*/i, "Pickup request: ");
}

function getServiceWindowCopy(order: Order) {
  const normalized = (order.serviceWindow || "")
    .replace(/delivery timing confirmed after checkout/gi, "Pickup details confirmed after checkout")
    .replace(/delivery details confirmed after checkout/gi, "Pickup details confirmed after checkout")
    .replace(/^delivery\s*:\s*/i, "Pickup: ");

  return normalized.trim() || DEFAULT_PICKUP_WINDOW_COPY;
}

function formatOrderDateTime(value: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Not available";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatServiceDate(value: string | null) {
  if (!value) return "Tomorrow (date pending)";
  const parsed = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) return "Tomorrow (date pending)";
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function getNextStepSupportCopy(status: Order["status"]) {
  switch (status) {
    case "New":
      return "Review order notes, confirm item availability, and begin prep.";
    case "In Prep":
      return "Finish prep and packaging, then move to ready-for-pickup.";
    case "Ready":
      return "Order is staged. Confirm customer handoff when pickup happens.";
    case "Picked Up":
      return "Pickup is complete. Add final notes only if needed.";
    case "Cancelled":
      return "Order was cancelled. Keep notes for any follow-up context.";
    default:
      return "Advance when the next pickup step is complete.";
  }
}

function buildRiskyTransitionConfirmationCopy(order: Order, targetStatus: Order["status"]) {
  const targetLabel = getOrderStatusDisplayLabel(targetStatus);
  const context = [
    `Order: ${order.orderNumber.toUpperCase()}`,
    `Customer: ${order.customerName}`,
    `Contact: ${order.customerEmail || "No email captured"}`,
    `Current status: ${getOrderStatusDisplayLabel(order.status)}`,
    `Change to: ${targetLabel}`,
  ];

  if (targetStatus === "Picked Up") {
    return [
      "Confirm pickup handoff before marking this order completed.",
      "",
      ...context,
    ].join("\n");
  }

  return [
    "Cancel this pickup order only if the customer cannot collect it.",
    "",
    ...context,
  ].join("\n");
}

const ORDER_WORKFLOW: Array<{
  status: Order["status"];
  label: string;
  copy: string;
}> = [
  {
    status: "New",
    label: "New Request",
    copy: "Order synced and waiting for operator review.",
  },
  {
    status: "In Prep",
    label: "In Prep",
    copy: "Kitchen is actively preparing this pickup order.",
  },
  {
    status: "Ready",
    label: "Ready For Pickup",
    copy: "Order is packed and staged for customer handoff.",
  },
  {
    status: "Picked Up",
    label: "Completed",
    copy: "Pickup handoff confirmed.",
  },
  {
    status: "Cancelled",
    label: "Cancelled",
    copy: "Order closed without pickup.",
  },
];

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
  const serviceWindowCopy = selectedOrder ? getServiceWindowCopy(selectedOrder) : DEFAULT_PICKUP_WINDOW_COPY;
  const pickupTimingBucket = selectedOrder ? getPickupTimingBucket(selectedOrder.serviceDate) : "unavailable";
  const pickupTimingLabel = selectedOrder ? getPickupTimingLabel(selectedOrder.serviceDate) : "Date unavailable";
  const hasSpecificPickupWindow = serviceWindowCopy.toLowerCase() !== DEFAULT_PICKUP_WINDOW_COPY.toLowerCase();
  const showUnavailableTimingLabel = pickupTimingBucket !== "unavailable" || !hasSpecificPickupWindow;
  const pickupTimingSummary = showUnavailableTimingLabel ? pickupTimingLabel : null;
  const pickupDateValue = selectedOrder?.serviceDate
    ? formatServiceDate(selectedOrder.serviceDate)
    : hasSpecificPickupWindow
      ? "See pickup window"
      : "Date unavailable";
  const pickupTimingValue =
    pickupTimingBucket === "unavailable" && hasSpecificPickupWindow
      ? serviceWindowCopy
      : pickupTimingLabel;
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

  async function handleStatusTransitionRequest(targetStatus: Order["status"]) {
    if (!selectedOrder) return;

    if (isRiskyOrderStatusTransition(selectedOrder.status, targetStatus)) {
      const confirmed = window.confirm(
        buildRiskyTransitionConfirmationCopy(selectedOrder, targetStatus),
      );
      if (!confirmed) return;
    }

    await onAdvanceStatus(selectedOrder.id, targetStatus);
  }

  return (
    <aside className="detail-card">
      <div className="card-head">
        <div>
          <p className="card-kicker">Selected Order</p>
          <h2 className="card-title">
            {selectedOrder ? `${shortOrderNumber(selectedOrder.orderNumber)} · ${selectedOrder.customerName}` : "No order selected"}
          </h2>
        </div>
      </div>

      {selectedOrder ? (
        <div className="detail-panel">
          <div className="detail-hero">
            <h3>{getOrderStatusDisplayLabel(selectedOrder.status)}</h3>
            <p>
              {`Next-day pickup order${pickupTimingSummary ? ` (${pickupTimingSummary})` : ""}. ${serviceWindowCopy}. Total ${formatCurrency(selectedOrder.totalCents)}.`}
            </p>
          </div>
          <div className="detail-list">
            <div className="detail-list-item">
              <span>Customer</span>
              <strong>{selectedOrder.customerName}</strong>
            </div>
            <div className="detail-list-item">
              <span>Contact</span>
              <strong>{selectedOrder.customerEmail || "No email captured"}</strong>
            </div>
            <div className="detail-list-item">
              <span>Pickup date</span>
              <strong>{pickupDateValue}</strong>
            </div>
            <div className="detail-list-item">
              <span>Pickup timing</span>
              <strong>{pickupTimingValue}</strong>
            </div>
            <div className="detail-list-item">
              <span>Queue entered</span>
              <strong>{formatOrderDateTime(selectedOrder.createdAt)}</strong>
            </div>
          </div>
          <div className="detail-note">
            <strong>Next action</strong>
            {nextActionLabel
              ? `${nextActionLabel}. ${getNextStepSupportCopy(selectedOrder.status)}`
              : getNextStepSupportCopy(selectedOrder.status)}
          </div>
          <div className="detail-note">
            <strong>Customer request</strong>
            {getCustomerRequestCopy(selectedOrder)}
          </div>
          <div className="detail-note">
            <strong>Internal operator note</strong>
            Keep short handoff context for prep timing, pickup coordination, or customer follow-up.
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
            {ORDER_WORKFLOW.map((step, index) => {
              const orderStageIndex = ORDER_WORKFLOW.findIndex((entry) => entry.status === selectedOrder.status);
              const isDone = index < orderStageIndex;
              const isCurrent = index === orderStageIndex;
              return (
                <div
                  className={`timeline-item ${isDone || isCurrent ? "done" : ""} ${isCurrent ? "current" : ""}`}
                  key={`${selectedOrder.id}-${step.status}-${index}`}
                >
                <div className="timeline-dot" />
                <div className="timeline-copy">
                  <strong>{step.label}</strong>
                  <span>{isCurrent ? "Current queue stage." : step.copy}</span>
                </div>
              </div>
              );
            })}
          </div>
          <div className="detail-actions">
            {selectedOrder && nextStatus && nextActionLabel ? (
              <button
                className="topbar-action"
                disabled={statusUpdating}
                onClick={() => {
                  void handleStatusTransitionRequest(nextStatus);
                }}
                type="button"
              >
                {statusUpdating ? "Updating..." : nextActionLabel}
              </button>
            ) : null}
            {selectedOrder && canCancelOrderStatus(selectedOrder.status) ? (
              <button
                className="ghost-button"
                disabled={statusUpdating}
                onClick={() => {
                  void handleStatusTransitionRequest("Cancelled");
                }}
                style={{ color: "#D27A62", borderColor: "rgba(210,122,98,0.5)" }}
                type="button"
              >
                Cancel order
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
