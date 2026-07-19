"use client";

import { useMemo, useState } from "react";

import type { OpsApi } from "@/components/dashboard/dashboard-app";
import { Sheet } from "@/components/ui/sheet";
import { formatCurrency, statusTone, summarizeItems, timeAgo } from "@/lib/dashboard/format";
import {
  canCancelOrderStatus,
  getNextOrderStatus,
  getOrderStatusDisplayLabel,
  getPickupTimingLabel,
} from "@/lib/dashboard/order-status";
import type { Order, OrderStatus } from "@/types/domain";

const COLUMNS: Array<{ status: OrderStatus; title: string; className: string; hint: string }> = [
  { status: "New", title: "New", className: "is-new", hint: "Fresh requests — accept by starting prep." },
  { status: "In Prep", title: "In Prep", className: "is-prep", hint: "On the grill right now." },
  { status: "Ready", title: "Ready", className: "is-ready", hint: "Waiting on pickup." },
  { status: "Picked Up", title: "Done", className: "is-done", hint: "Completed today." },
];

function OrderTicket({
  order,
  now,
  busy,
  onOpen,
  onAdvance,
}: {
  order: Order;
  now: number;
  busy: boolean;
  onOpen: () => void;
  onAdvance: (next: OrderStatus) => void;
}) {
  const next = getNextOrderStatus(order.status);

  return (
    <div
      className={`ticket ${order.status === "New" ? "is-new" : ""}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="ticket-top">
        <span className="ticket-num">{order.orderNumber}</span>
        <span className="muted" style={{ fontSize: "0.75rem" }}>{timeAgo(order.createdAt, now)}</span>
      </div>
      <div className="ticket-name">{order.customerName}</div>
      <div className="ticket-items">{summarizeItems(order)}</div>
      {order.customRequest?.trim() ? <div className="ticket-flag">📝 Special request</div> : null}
      <div className="ticket-foot">
        <span className="ticket-total">{formatCurrency(order.totalCents)}</span>
        {next ? (
          <button
            className="btn btn-sm btn-primary"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onAdvance(next);
            }}
            type="button"
          >
            {busy ? "…" : `→ ${next === "Picked Up" ? "Done" : next}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OrderSheet({
  order,
  now,
  api,
  busy,
  setBusy,
  onClose,
}: {
  order: Order;
  now: number;
  api: OpsApi;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState(order.operatorNote ?? "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const next = getNextOrderStatus(order.status);

  async function run(action: () => Promise<boolean>, closeAfter = false) {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok && closeAfter) onClose();
  }

  return (
    <Sheet
      headerExtra={<span className={`pill ${statusTone(order.status)}`}>{getOrderStatusDisplayLabel(order.status)}</span>}
      onClose={onClose}
      title={`${order.orderNumber} · ${order.customerName}`}
    >
      <div>
        {order.items.map((item) => (
          <div className="line-item" key={item.id}>
            <span>
              {item.quantity}× {item.name}
              {item.notes ? <span className="muted" style={{ display: "block" }}>{item.notes}</span> : null}
            </span>
            <strong>{formatCurrency(item.unitPriceCents * item.quantity)}</strong>
          </div>
        ))}
        <div className="line-item" style={{ borderTop: "1px solid var(--line)", fontWeight: 800 }}>
          <span>Total</span>
          <strong>{formatCurrency(order.totalCents)}</strong>
        </div>
      </div>

      {order.customRequest?.trim() ? (
        <div className="callout">📝 <strong>Special request:</strong> {order.customRequest}</div>
      ) : null}

      <div className="info-rows">
        <div className="info-row"><span>Pickup</span><strong>{getPickupTimingLabel(order.serviceDate)} · {order.serviceWindow}</strong></div>
        <div className="info-row"><span>Placed</span><strong>{timeAgo(order.createdAt, now)}</strong></div>
        <div className="info-row"><span>Payment</span><strong>{order.paymentProvider} · {order.paymentStatus}</strong></div>
        {order.customerEmail ? (
          <div className="info-row"><span>Email</span><strong><a href={`mailto:${order.customerEmail}`} style={{ color: "var(--gold)" }}>{order.customerEmail}</a></strong></div>
        ) : null}
        <div className="info-row"><span>Zone</span><strong>{order.customerZone}</strong></div>
      </div>

      <label className="field">
        Kitchen note (only you see this)
        <textarea className="textarea" onChange={(event) => setNote(event.target.value)} value={note} />
      </label>
      <button
        className="btn btn-sm"
        disabled={busy || note === (order.operatorNote ?? "")}
        onClick={() => run(() => api.saveOrderNote(order.id, note.trim()))}
        type="button"
      >
        Save note
      </button>

      {next ? (
        <button
          className="btn btn-primary btn-block"
          disabled={busy}
          onClick={() => run(() => api.advanceOrder(order.id, next), true)}
          type="button"
        >
          {busy ? "Working…" : `Mark ${getOrderStatusDisplayLabel(next)}`}
        </button>
      ) : null}

      {canCancelOrderStatus(order.status) ? (
        confirmCancel ? (
          <div className="callout danger">
            Cancel this order for good?
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
              <button
                className="btn btn-sm btn-danger"
                disabled={busy}
                onClick={() => run(() => api.advanceOrder(order.id, "Cancelled"), true)}
                type="button"
              >
                Yes, cancel it
              </button>
              <button className="btn btn-sm" onClick={() => setConfirmCancel(false)} type="button">
                Keep the order
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-ghost btn-block" onClick={() => setConfirmCancel(true)} type="button">
            Cancel order…
          </button>
        )
      ) : null}
    </Sheet>
  );
}

export function OrdersView({ orders, now, api }: { orders: Order[]; now: number; api: OpsApi }) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const byStatus = useMemo(() => {
    const map = new Map<OrderStatus, Order[]>();
    for (const column of COLUMNS) map.set(column.status, []);

    const sorted = [...orders].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

    for (const order of sorted) {
      const bucket = map.get(order.status);
      if (bucket) bucket.push(order);
    }

    const done = map.get("Picked Up");
    if (done) done.reverse();

    return map;
  }, [orders]);

  const cancelled = useMemo(
    () =>
      orders
        .filter((order) => order.status === "Cancelled")
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [orders],
  );

  const openOrder = orders.find((order) => order.id === openOrderId) ?? null;

  async function advance(order: Order, next: OrderStatus) {
    setBusyId(order.id);
    await api.advanceOrder(order.id, next);
    setBusyId(null);
  }

  return (
    <>
      <div className="board">
        {COLUMNS.map((column) => {
          const columnOrders = byStatus.get(column.status) ?? [];
          const visible = column.status === "Picked Up" ? columnOrders.slice(0, 8) : columnOrders;
          return (
            <section className={`board-col ${column.className}`} key={column.status}>
              <div className="board-col-head">
                <span className="board-col-title">{column.title}</span>
                <span className="board-count">{columnOrders.length}</span>
              </div>
              {visible.length ? (
                visible.map((order) => (
                  <OrderTicket
                    busy={busyId === order.id}
                    key={order.id}
                    now={now}
                    onAdvance={(next) => advance(order, next)}
                    onOpen={() => setOpenOrderId(order.id)}
                    order={order}
                  />
                ))
              ) : (
                <div className="empty-col">{column.hint}</div>
              )}
            </section>
          );
        })}
      </div>

      {cancelled.length ? (
        <div style={{ marginTop: "1.1rem" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowHistory((value) => !value)} type="button">
            {showHistory ? "Hide" : "Show"} cancelled orders ({cancelled.length})
          </button>
          {showHistory ? (
            <div className="stack" style={{ gap: "0.5rem", marginTop: "0.6rem", maxWidth: 480 }}>
              {cancelled.map((order) => (
                <button
                  className="attn-card danger"
                  key={order.id}
                  onClick={() => setOpenOrderId(order.id)}
                  type="button"
                >
                  <span className="attn-body">
                    <span className="attn-title">{order.orderNumber} · {order.customerName}</span>
                    <span className="attn-copy" style={{ display: "block" }}>
                      {formatCurrency(order.totalCents)} · {timeAgo(order.createdAt, now)}
                    </span>
                  </span>
                  <span aria-hidden className="attn-go">›</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {openOrder ? (
        <OrderSheet
          api={api}
          busy={busyId === openOrder.id}
          now={now}
          onClose={() => setOpenOrderId(null)}
          order={openOrder}
          setBusy={(value) => setBusyId(value ? openOrder.id : null)}
        />
      ) : null}
    </>
  );
}
