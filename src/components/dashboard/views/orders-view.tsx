"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { OpsApi } from "@/components/dashboard/dashboard-app";
import { EmptyState } from "@/components/foundation/EmptyState";
import { Sheet } from "@/components/ui/sheet";
import { formatCurrency, statusTone, summarizeItems, timeAgo } from "@/lib/dashboard/format";
import {
  canCancelOrderStatus,
  getNextOrderStatus,
  getOrderStatusDisplayLabel,
  getPickupTimingLabel,
} from "@/lib/dashboard/order-status";
import {
  filterOrderWorkspace,
  getOrderItemCount,
  getOrderWorkspaceCounts,
  orderMatchesSearch,
  type OrderWorkspaceFilter,
} from "@/lib/dashboard/order-workspace";
import type { Order, OrderStatus } from "@/types/domain";

const COLUMNS: Array<{ status: OrderStatus; title: string; hint: string }> = [
  { status: "New", title: "New", hint: "Fresh requests will appear here." },
  { status: "In Prep", title: "In Prep", hint: "No orders are being prepared." },
  { status: "Ready", title: "Ready", hint: "No orders are waiting for pickup." },
  { status: "Picked Up", title: "Completed", hint: "No completed orders match this view." },
];

const FILTERS: Array<{ key: OrderWorkspaceFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "New", label: "New" },
  { key: "In Prep", label: "In prep" },
  { key: "Ready", label: "Ready" },
  { key: "Picked Up", label: "Completed" },
];

const LIFECYCLE: OrderStatus[] = ["New", "In Prep", "Ready", "Picked Up"];

function statusClass(status: OrderStatus) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function orderAgeTone(order: Order, now: number) {
  if (order.status === "Picked Up" || order.status === "Cancelled") return "settled";
  const createdAt = new Date(order.createdAt).getTime();
  if (!Number.isFinite(createdAt)) return "fresh";
  const minutes = Math.max(0, (now - createdAt) / 60_000);
  if (minutes >= 45) return "urgent";
  if (minutes >= 20) return "aging";
  return "fresh";
}

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
  const itemCount = getOrderItemCount(order);

  return (
    <article
      className="order-ticket"
      data-age={orderAgeTone(order, now)}
      data-status={statusClass(order.status)}
    >
      <button
        aria-label={`Open ${order.orderNumber} for ${order.customerName}`}
        className="order-ticket__open"
        onClick={onOpen}
        type="button"
      >
        <span className="order-ticket__topline">
          <span className="order-ticket__number">{order.orderNumber}</span>
          <span className="order-ticket__age">{timeAgo(order.createdAt, now)}</span>
        </span>
        <span className="order-ticket__customer">{order.customerName}</span>
        <span className="order-ticket__items">{summarizeItems(order)}</span>
        <span className="order-ticket__meta">
          <span>{order.fulfillmentMethod === "delivery" ? "Delivery" : "Pickup"}</span>
          <span aria-hidden="true">·</span>
          <span>{order.serviceWindow}</span>
          <span aria-hidden="true">·</span>
          <span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>
        </span>
        {order.customRequest?.trim() ? (
          <span className="order-ticket__flag">Special instructions</span>
        ) : null}
      </button>

      <footer className="order-ticket__footer">
        <strong>{formatCurrency(order.totalCents)}</strong>
        {next ? (
          <button
            className="order-workspace__advance"
            disabled={busy}
            onClick={() => onAdvance(next)}
            type="button"
          >
            {busy ? "Updating…" : getOrderStatusDisplayLabel(next)}
            <span aria-hidden="true">→</span>
          </button>
        ) : (
          <span className="order-ticket__complete">Completed</span>
        )}
      </footer>
    </article>
  );
}

function Lifecycle({ status }: { status: OrderStatus }) {
  if (status === "Cancelled") {
    return <div className="order-lifecycle order-lifecycle--cancelled">Order cancelled</div>;
  }

  const current = LIFECYCLE.indexOf(status);

  return (
    <ol aria-label="Order progress" className="order-lifecycle">
      {LIFECYCLE.map((step, index) => (
        <li
          aria-current={index === current ? "step" : undefined}
          className="order-lifecycle__step"
          data-state={index < current ? "complete" : index === current ? "current" : "upcoming"}
          key={step}
        >
          <span className="order-lifecycle__dot" />
          <span>{getOrderStatusDisplayLabel(step)}</span>
        </li>
      ))}
    </ol>
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
      headerExtra={
        <span className={`pill ${statusTone(order.status)}`}>
          {getOrderStatusDisplayLabel(order.status)}
        </span>
      }
      onClose={onClose}
      title={`${order.orderNumber} · ${order.customerName}`}
    >
      <div className="order-detail">
        <Lifecycle status={order.status} />

        <section aria-labelledby="order-items-heading" className="order-detail__section">
          <h3 id="order-items-heading">Order items</h3>
          <div className="order-detail__items">
            {order.items.map((item) => (
              <div className="order-detail__item" key={item.id}>
                <span>
                  <strong>{item.quantity}× {item.name}</strong>
                  {item.notes ? <small>{item.notes}</small> : null}
                </span>
                <strong>{formatCurrency(item.unitPriceCents * item.quantity)}</strong>
              </div>
            ))}
            <div className="order-detail__total">
              <span>Total</span>
              <strong>{formatCurrency(order.totalCents)}</strong>
            </div>
          </div>
        </section>

        {order.customRequest?.trim() ? (
          <section className="order-detail__request">
            <span>Special instructions</span>
            <p>{order.customRequest}</p>
          </section>
        ) : null}

        <section aria-labelledby="order-details-heading" className="order-detail__section">
          <h3 id="order-details-heading">Service details</h3>
          <dl className="order-detail__facts">
            <div><dt>Fulfillment</dt><dd>{order.fulfillmentMethod === "delivery" ? "Delivery" : "Pickup"}</dd></div>
            <div><dt>Service</dt><dd>{getPickupTimingLabel(order.serviceDate)} · {order.serviceWindow}</dd></div>
            <div><dt>Placed</dt><dd>{timeAgo(order.createdAt, now)}</dd></div>
            <div><dt>Payment</dt><dd>{order.paymentProvider} · {order.paymentStatus}</dd></div>
            {order.customerEmail ? (
              <div><dt>Email</dt><dd><a href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a></dd></div>
            ) : null}
            <div><dt>Zone</dt><dd>{order.customerZone}</dd></div>
          </dl>
        </section>

        <section aria-labelledby="kitchen-note-heading" className="order-detail__section">
          <h3 id="kitchen-note-heading">Kitchen note</h3>
          <p className="order-detail__section-copy">Visible only to operators.</p>
          <textarea
            aria-label="Kitchen note"
            className="textarea"
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
          <button
            className="btn btn-sm"
            disabled={busy || note === (order.operatorNote ?? "")}
            onClick={() => run(() => api.saveOrderNote(order.id, note.trim()))}
            type="button"
          >
            Save note
          </button>
        </section>

        {next ? (
          <button
            className="btn btn-primary btn-block order-detail__primary-action"
            disabled={busy}
            onClick={() => run(() => api.advanceOrder(order.id, next), true)}
            type="button"
          >
            {busy ? "Updating order…" : `Mark ${getOrderStatusDisplayLabel(next)}`}
          </button>
        ) : null}

        {canCancelOrderStatus(order.status) ? (
          confirmCancel ? (
            <div className="order-detail__cancel-confirmation" role="alert">
              <strong>Cancel this order?</strong>
              <p>This moves it out of the live workflow. The action remains recorded in order history.</p>
              <div>
                <button
                  className="btn btn-sm btn-danger"
                  disabled={busy}
                  onClick={() => run(() => api.advanceOrder(order.id, "Cancelled"), true)}
                  type="button"
                >
                  Yes, cancel order
                </button>
                <button className="btn btn-sm" onClick={() => setConfirmCancel(false)} type="button">
                  Keep order
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn-ghost btn-block" onClick={() => setConfirmCancel(true)} type="button">
              Cancel order…
            </button>
          )
        ) : null}
      </div>
    </Sheet>
  );
}

export function OrdersView({ orders, now, api }: { orders: Order[]; now: number; api: OpsApi }) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OrderWorkspaceFilter>("active");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !isEditing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const counts = useMemo(() => getOrderWorkspaceCounts(orders), [orders]);
  const filteredOrders = useMemo(
    () => filterOrderWorkspace(orders, { filter, search }),
    [filter, orders, search],
  );

  const byStatus = useMemo(() => {
    const map = new Map<OrderStatus, Order[]>();
    for (const column of COLUMNS) map.set(column.status, []);

    const sorted = [...filteredOrders].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

    for (const order of sorted) {
      const bucket = map.get(order.status);
      if (bucket) bucket.push(order);
    }

    const done = map.get("Picked Up");
    if (done) done.reverse();

    return map;
  }, [filteredOrders]);

  const visibleColumns = useMemo(() => {
    if (filter === "active") return COLUMNS.filter((column) => column.status !== "Picked Up");
    if (filter !== "all") return COLUMNS.filter((column) => column.status === filter);
    return COLUMNS;
  }, [filter]);

  const cancelled = useMemo(
    () =>
      orders
        .filter((order) => order.status === "Cancelled" && orderMatchesSearch(order, search))
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [orders, search],
  );

  const openOrder = orders.find((order) => order.id === openOrderId) ?? null;
  const activeOrders = orders.filter((order) => ["New", "In Prep", "Ready"].includes(order.status));
  const pickupCount = activeOrders.filter((order) => order.fulfillmentMethod === "pickup").length;
  const deliveryCount = activeOrders.length - pickupCount;
  const specialCount = activeOrders.filter((order) => order.customRequest?.trim()).length;

  async function advance(order: Order, next: OrderStatus) {
    setBusyId(order.id);
    await api.advanceOrder(order.id, next);
    setBusyId(null);
  }

  function clearQuery() {
    setSearch("");
    setFilter("active");
    searchRef.current?.focus();
  }

  return (
    <div className="order-workspace">
      <section aria-label="Order summary" className="order-workspace__summary">
        <div><span>Active queue</span><strong>{counts.active}</strong></div>
        <div><span>Ready now</span><strong>{counts.Ready}</strong></div>
        <div><span>Fulfillment</span><strong>{pickupCount} pickup · {deliveryCount} delivery</strong></div>
        <div><span>Special instructions</span><strong>{specialCount}</strong></div>
      </section>

      <section aria-label="Order controls" className="order-workspace__toolbar">
        <div className="order-workspace__search">
          <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
            <circle cx="11" cy="11" r="7" />
            <path d="m16.5 16.5 4 4" />
          </svg>
          <label className="sr-only" htmlFor="order-search">Search orders</label>
          <input
            id="order-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, customer, item, or zone"
            ref={searchRef}
            type="search"
            value={search}
          />
          <kbd>/</kbd>
        </div>

        <div aria-label="Filter orders" className="order-workspace__filters" role="group">
          {FILTERS.map((option) => {
            const count = counts[option.key];
            return (
              <button
                aria-pressed={filter === option.key}
                key={option.key}
                onClick={() => setFilter(option.key)}
                type="button"
              >
                <span>{option.label}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div aria-live="polite" className="order-workspace__result-count">
        Showing {filteredOrders.length} of {counts.all} non-cancelled orders
      </div>

      {filteredOrders.length ? (
        <div className="order-board" data-columns={visibleColumns.length}>
          {visibleColumns.map((column) => {
            const columnOrders = byStatus.get(column.status) ?? [];
            const visible = column.status === "Picked Up" ? columnOrders.slice(0, 12) : columnOrders;
            return (
              <section className="order-lane" data-status={statusClass(column.status)} key={column.status}>
                <header className="order-lane__header">
                  <div>
                    <span className="order-lane__signal" />
                    <h2>{column.title}</h2>
                  </div>
                  <span>{columnOrders.length}</span>
                </header>
                <div className="order-lane__body">
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
                    <p className="order-lane__empty">{column.hint}</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          action={
            <button className="frontier-link-button" onClick={clearQuery} type="button">
              Clear search and filters
            </button>
          }
          className="order-workspace__empty"
          description="Try a customer name, order number, menu item, or a different workflow filter."
          title="No orders match this view"
        />
      )}

      {counts.Cancelled ? (
        <section className="order-history">
          <button
            aria-expanded={showHistory}
            className="order-history__toggle"
            onClick={() => setShowHistory((value) => !value)}
            type="button"
          >
            <span>
              <strong>Cancelled orders</strong>
              <small>Retained for operational history</small>
            </span>
            <span>{cancelled.length}</span>
            <span aria-hidden="true">{showHistory ? "−" : "+"}</span>
          </button>
          {showHistory ? (
            <div className="order-history__list">
              {cancelled.length ? cancelled.map((order) => (
                <button key={order.id} onClick={() => setOpenOrderId(order.id)} type="button">
                  <span><strong>{order.orderNumber}</strong><small>{order.customerName}</small></span>
                  <span>{formatCurrency(order.totalCents)}</span>
                  <span>{timeAgo(order.createdAt, now)}</span>
                </button>
              )) : (
                <p>No cancelled orders match the current search.</p>
              )}
            </div>
          ) : null}
        </section>
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
    </div>
  );
}
