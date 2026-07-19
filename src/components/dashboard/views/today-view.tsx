"use client";

import { useMemo } from "react";

import type { OpsApi, ViewKey } from "@/components/dashboard/dashboard-app";
import { formatCurrency, isActiveOrder, summarizeItems, timeAgo } from "@/lib/dashboard/format";
import { getNextOrderStatus } from "@/lib/dashboard/order-status";
import type { DashboardSnapshot, InventoryItem } from "@/types/domain";

interface AttentionItem {
  id: string;
  tone: "danger" | "warning" | "info" | "success";
  icon: string;
  title: string;
  copy: string;
  target: ViewKey;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Late night at the kitchen";
  if (hour < 12) return "Good morning, Chef";
  if (hour < 17) return "Good afternoon, Chef";
  return "Good evening, Chef";
}

export function TodayView({
  snapshot,
  lowStock,
  now,
  goTo,
  api,
}: {
  snapshot: DashboardSnapshot;
  lowStock: InventoryItem[];
  now: number;
  goTo: (view: ViewKey) => void;
  api: OpsApi;
}) {
  const newOrders = snapshot.orders.filter((order) => order.status === "New");
  const readyOrders = snapshot.orders.filter((order) => order.status === "Ready");
  const inPrepOrders = snapshot.orders.filter((order) => order.status === "In Prep");
  const activeCount = snapshot.orders.filter(isActiveOrder).length;

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    if (newOrders.length) {
      items.push({
        id: "new-orders",
        tone: "info",
        icon: "🆕",
        title: `${newOrders.length} new order${newOrders.length > 1 ? "s" : ""} waiting`,
        copy: newOrders
          .slice(0, 3)
          .map((order) => `${order.orderNumber} · ${order.customerName}`)
          .join("  •  "),
        target: "orders",
      });
    }

    if (readyOrders.length) {
      items.push({
        id: "ready-orders",
        tone: "warning",
        icon: "🛎️",
        title: `${readyOrders.length} order${readyOrders.length > 1 ? "s" : ""} ready for pickup`,
        copy: "Waiting on the customer — mark picked up when they collect.",
        target: "orders",
      });
    }

    const outItems = lowStock.filter((item) => item.status === "Out");
    const lowItems = lowStock.filter((item) => item.status === "Low");

    if (outItems.length) {
      items.push({
        id: "out-stock",
        tone: "danger",
        icon: "🚨",
        title: `${outItems.map((item) => item.name).join(", ")} — out of stock`,
        copy: "Linked dishes may need pausing until you restock.",
        target: "inventory",
      });
    }

    if (lowItems.length) {
      items.push({
        id: "low-stock",
        tone: "warning",
        icon: "📉",
        title: `${lowItems.length} ingredient${lowItems.length > 1 ? "s" : ""} running low`,
        copy: lowItems.map((item) => `${item.name} (${item.onHand} ${item.unit})`).slice(0, 3).join("  •  "),
        target: "inventory",
      });
    }

    const specialRequests = snapshot.orders.filter(
      (order) => isActiveOrder(order) && order.customRequest?.trim(),
    );
    if (specialRequests.length) {
      items.push({
        id: "special",
        tone: "info",
        icon: "📝",
        title: `${specialRequests.length} order${specialRequests.length > 1 ? "s have" : " has"} special requests`,
        copy: "Open the order board to read them before prep.",
        target: "orders",
      });
    }

    return items;
  }, [newOrders, readyOrders, lowStock, snapshot.orders]);

  const nextUp = newOrders[0] ?? inPrepOrders[0] ?? readyOrders[0] ?? null;
  const nextStatus = nextUp ? getNextOrderStatus(nextUp.status) : null;

  return (
    <>
      <section className="hero">
        <h2 className="hero-greeting">{greeting()} 🔥</h2>
        <p className="hero-copy">
          {activeCount
            ? `${activeCount} active order${activeCount > 1 ? "s" : ""} in the queue · ${snapshot.operations.queueSummary}`
            : "The queue is clear. Prep ahead, update the menu, or check what's been selling."}
        </p>

        <div className="kpi-row" style={{ marginBottom: 0 }}>
          {snapshot.kpis.map((kpi) => (
            <div className={`kpi ${kpi.tone}`} key={kpi.label}>
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-delta">{kpi.delta}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="today-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <p className="kicker">Needs your attention</p>
              <h3 className="card-title">Work the list, top to bottom</h3>
            </div>
          </div>

          {attention.length ? (
            <div className="attention">
              {attention.map((item) => (
                <button className={`attn-card ${item.tone}`} key={item.id} onClick={() => goTo(item.target)} type="button">
                  <span aria-hidden className="attn-icon">{item.icon}</span>
                  <span className="attn-body">
                    <span className="attn-title">{item.title}</span>
                    <span className="attn-copy" style={{ display: "block" }}>{item.copy}</span>
                  </span>
                  <span aria-hidden className="attn-go">›</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="allclear">
              <div aria-hidden className="allclear-emoji">✨</div>
              <div className="allclear-title">All clear</div>
              Nothing is on fire. New orders and stock alerts will show up here first.
            </div>
          )}
        </section>

        <div className="stack">
          {nextUp ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <p className="kicker">Next up</p>
                  <h3 className="card-title">{nextUp.orderNumber} · {nextUp.customerName}</h3>
                </div>
                <span className={`pill ${nextUp.status === "New" ? "info" : nextUp.status === "Ready" ? "ember" : "warning"}`}>
                  {nextUp.status}
                </span>
              </div>
              <p className="muted" style={{ margin: "0 0 0.4rem" }}>{summarizeItems(nextUp)}</p>
              <p className="muted" style={{ margin: "0 0 0.9rem" }}>
                {formatCurrency(nextUp.totalCents)} · placed {timeAgo(nextUp.createdAt, now)}
              </p>
              {nextStatus ? (
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => api.advanceOrder(nextUp.id, nextStatus)}
                  type="button"
                >
                  Mark {nextStatus === "Picked Up" ? "Picked Up" : nextStatus}
                </button>
              ) : null}
              <button className="btn btn-ghost btn-block" onClick={() => goTo("orders")} style={{ marginTop: "0.5rem" }} type="button">
                Open full board
              </button>
            </section>
          ) : null}

          <section className="card">
            <div className="card-head">
              <div>
                <p className="kicker">Quick actions</p>
                <h3 className="card-title">Jump straight in</h3>
              </div>
            </div>
            <div className="stack" style={{ gap: "0.5rem" }}>
              <button className="btn btn-block" onClick={() => goTo("inventory")} type="button">
                📦 Update stock counts
              </button>
              <button className="btn btn-block" onClick={() => goTo("menu")} type="button">
                🍽️ Edit the live menu
              </button>
              <button className="btn btn-block" onClick={() => goTo("customers")} type="button">
                👥 Message subscribers
              </button>
              <button className="btn btn-block" onClick={() => goTo("analytics")} type="button">
                📈 See what&rsquo;s selling
              </button>
            </div>
          </section>

          {snapshot.insights.length ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <p className="kicker">Insight</p>
                  <h3 className="card-title">{snapshot.insights[0].title}</h3>
                </div>
                <span className="pill info">{snapshot.insights[0].confidence}%</span>
              </div>
              <p className="muted" style={{ margin: 0 }}>{snapshot.insights[0].summary}</p>
              <div className="callout" style={{ marginTop: "0.75rem" }}>
                💡 {snapshot.insights[0].actionText}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
