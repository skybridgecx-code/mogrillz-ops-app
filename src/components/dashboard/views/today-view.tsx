"use client";

import { useMemo } from "react";

import { FrontierNavIcon } from "@/components/dashboard/frontier-nav-icon";
import type { OpsApi } from "@/components/dashboard/dashboard-app";
import { EmptyState } from "@/components/foundation/EmptyState";
import { Panel } from "@/components/foundation/Panel";
import { SectionHeader } from "@/components/foundation/SectionHeader";
import { StatusBadge, type StatusBadgeStatus } from "@/components/foundation/StatusBadge";
import { formatCurrency, summarizeItems, timeAgo } from "@/lib/dashboard/format";
import type { ViewKey } from "@/lib/dashboard/navigation";
import { getNextOrderStatus } from "@/lib/dashboard/order-status";
import type { TodayReadModel } from "@/lib/dashboard/read-models";
import type { ApplicationAvailabilitySummary } from "@/lib/dashboard/readiness-summary";
import { getBusinessGreeting } from "@/lib/dashboard/metrics";
import type { OrderStatus } from "@/types/domain";

interface AttentionItem {
  id: string;
  tone: "danger" | "warning" | "neutral" | "success";
  title: string;
  copy: string;
  target: ViewKey;
}

const ACTIONS: ReadonlyArray<{
  target: ViewKey;
  label: string;
  detail: string;
}> = [
  { target: "orders", label: "Work the order board", detail: "Move tickets through service" },
  { target: "inventory", label: "Update stock", detail: "Record counts and shortages" },
  { target: "menu", label: "Manage the menu", detail: "Edit availability and dishes" },
  { target: "analytics", label: "Review performance", detail: "See sales and retention" },
];

function greeting(now: number) {
  return getBusinessGreeting(now);
}

function orderBadgeStatus(status: OrderStatus): StatusBadgeStatus {
  if (status === "Ready" || status === "Picked Up") return "ready";
  if (status === "Cancelled") return "blocked";
  if (status === "New" || status === "In Prep") return "review";
  return "neutral";
}

export function TodayView({
  model,
  now,
  goTo,
  api,
  readiness,
}: {
  model: TodayReadModel;
  now: number;
  goTo: (view: ViewKey) => void;
  api: OpsApi;
  readiness: ApplicationAvailabilitySummary;
}) {
  const { activeOrders, insights, kpis, lowStock, operations } = model;
  const newOrders = activeOrders.filter((order) => order.status === "New");
  const readyOrders = activeOrders.filter((order) => order.status === "Ready");
  const inPrepOrders = activeOrders.filter((order) => order.status === "In Prep");
  const activeCount = activeOrders.length;

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const outItems = lowStock.filter((item) => item.status === "Out");
    const lowItems = lowStock.filter((item) => item.status === "Low");

    if (outItems.length) {
      items.push({
        id: "out-stock",
        tone: "danger",
        title: `${outItems.length} ingredient${outItems.length > 1 ? "s are" : " is"} out of stock`,
        copy: `${outItems.map((item) => item.name).slice(0, 3).join(", ")}. Review linked dishes before accepting more demand.`,
        target: "inventory",
      });
    }

    if (readyOrders.length) {
      items.push({
        id: "ready-orders",
        tone: "warning",
        title: `${readyOrders.length} order${readyOrders.length > 1 ? "s are" : " is"} ready for pickup`,
        copy: "Confirm collection as customers arrive so the live queue stays accurate.",
        target: "orders",
      });
    }

    if (newOrders.length) {
      items.push({
        id: "new-orders",
        tone: "warning",
        title: `${newOrders.length} new order${newOrders.length > 1 ? "s need" : " needs"} review`,
        copy: newOrders
          .slice(0, 3)
          .map((order) => `${order.orderNumber} · ${order.customerName}`)
          .join("  •  "),
        target: "orders",
      });
    }

    if (lowItems.length) {
      items.push({
        id: "low-stock",
        tone: "warning",
        title: `${lowItems.length} ingredient${lowItems.length > 1 ? "s are" : " is"} below par`,
        copy: lowItems
          .slice(0, 3)
          .map((item) => `${item.name}: ${item.onHand} ${item.unit}`)
          .join("  •  "),
        target: "inventory",
      });
    }

    const specialRequests = activeOrders.filter((order) => order.customRequest?.trim());
    if (specialRequests.length) {
      items.push({
        id: "special-requests",
        tone: "neutral",
        title: `${specialRequests.length} active order${specialRequests.length > 1 ? "s include" : " includes"} special instructions`,
        copy: "Read the customer request before prep begins or the order advances.",
        target: "orders",
      });
    }

    return items;
  }, [activeOrders, lowStock, newOrders, readyOrders]);

  const nextUp = newOrders[0] ?? inPrepOrders[0] ?? readyOrders[0] ?? null;
  const nextStatus = nextUp ? getNextOrderStatus(nextUp.status) : null;
  const primaryInsight = insights[0] ?? null;

  return (
    <div className="command-center">
      <section className="command-center__intro" aria-labelledby="command-center-heading">
        <div>
          <h2 className="command-center__greeting" id="command-center-heading">{greeting(now)}. Here is the operating picture.</h2>
          <p className="command-center__summary">
            {activeCount
              ? `${activeCount} active order${activeCount === 1 ? "" : "s"} require coverage. Work the exception queue before routine updates.`
              : "The active queue is clear. Use this time to confirm stock, menu availability, and the next service plan."}
          </p>
        </div>
        <div className="command-center__service">
          <span className="command-center__service-label">Current service</span>
          <StatusBadge status={activeCount ? "review" : "ready"}>{operations.status}</StatusBadge>
          <span className="command-center__service-window">{operations.serviceWindow}</span>
        </div>
      </section>

      <section aria-label="Canonical operational metrics" className="command-center__metrics">
        {kpis.map((kpi) => (
          <Panel className="command-metric" data-tone={kpi.tone} key={kpi.label}>
            <p className="command-metric__label">{kpi.label}</p>
            <p className="command-metric__value">{kpi.value}</p>
            <p className="command-metric__delta">{kpi.delta}</p>
          </Panel>
        ))}
      </section>

      <div className="command-center__layout">
        <div className="command-center__primary">
          <Panel className="command-panel--flush">
            <SectionHeader
              action={<span className="command-panel__meta">{attention.length} open</span>}
              description="Items are ordered by operational risk. Open a row to continue in the owning workspace."
              eyebrow="Exception queue"
              title="What needs attention"
            />
            {attention.length ? (
              <div className="command-exceptions">
                {attention.map((item) => (
                  <button
                    className="frontier-exception"
                    data-tone={item.tone}
                    key={item.id}
                    onClick={() => goTo(item.target)}
                    type="button"
                  >
                    <span aria-hidden="true" className="frontier-exception__signal" />
                    <span>
                      <span className="frontier-exception__title">{item.title}</span>
                      <span className="frontier-exception__copy">{item.copy}</span>
                    </span>
                    <span aria-hidden="true" className="frontier-exception__arrow">›</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                className="command-empty"
                description="New orders, pickup handoffs, and stock pressure will appear here when action is required."
                icon={<FrontierNavIcon view="today" />}
                title="No active exceptions"
              />
            )}
          </Panel>

          <Panel className="command-panel">
            <SectionHeader
              description="Direct access to the most common operating tasks."
              eyebrow="Operator shortcuts"
              title="Continue the work"
            />
            <div className="command-actions" style={{ marginTop: "1.25rem" }}>
              {ACTIONS.map((action) => (
                <button className="frontier-action" key={action.target} onClick={() => goTo(action.target)} type="button">
                  <span aria-hidden="true" className="frontier-action__icon">
                    <FrontierNavIcon view={action.target} />
                  </span>
                  <span>
                    <span className="frontier-action__label">{action.label}</span>
                    <span className="frontier-action__detail">{action.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="command-center__secondary" aria-label="Supporting operations context">
          <Panel className="command-panel">
            <SectionHeader
              action={nextUp ? <StatusBadge status={orderBadgeStatus(nextUp.status)}>{nextUp.status}</StatusBadge> : null}
              eyebrow="Next actionable order"
              title={nextUp ? `${nextUp.orderNumber} · ${nextUp.customerName}` : "Queue is clear"}
            />
            {nextUp ? (
              <div className="next-order" style={{ marginTop: "1.25rem" }}>
                <div>
                  <p className="next-order__items">{summarizeItems(nextUp)}</p>
                  <p className="next-order__meta">
                    {formatCurrency(nextUp.totalCents)} · placed {timeAgo(nextUp.createdAt, now)}
                  </p>
                </div>
                <div className="next-order__actions">
                  {nextStatus ? (
                    <button
                      className="frontier-primary-button"
                      onClick={() => api.advanceOrder(nextUp.id, nextStatus)}
                      type="button"
                    >
                      Mark {nextStatus}
                    </button>
                  ) : null}
                  <button className="frontier-link-button" onClick={() => goTo("orders")} type="button">
                    Open board
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                description="There are no new, in-prep, or ready orders in the active queue."
                icon={<FrontierNavIcon view="orders" />}
                title="Nothing waiting"
              />
            )}
          </Panel>

          <Panel className="command-panel">
            <SectionHeader
              action={<button className="frontier-link-button" onClick={() => goTo("inventory")} type="button">Open inventory</button>}
              eyebrow="Inventory pressure"
              title={lowStock.length ? `${lowStock.length} item${lowStock.length === 1 ? "" : "s"} need review` : "Stock is within range"}
            />
            {lowStock.length ? (
              <div className="command-stock" style={{ marginTop: "1rem" }}>
                {lowStock.slice(0, 4).map((item) => (
                  <div className="command-stock__item" key={item.id}>
                    <div>
                      <p className="command-stock__name">{item.name}</p>
                      <p className="command-stock__detail">{item.onHand} {item.unit} on hand · par {item.parLevel}</p>
                    </div>
                    <StatusBadge status={item.status === "Out" ? "blocked" : "review"}>{item.status}</StatusBadge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                description="No inventory item is currently marked low or out."
                icon={<FrontierNavIcon view="inventory" />}
                title="No stock exceptions"
              />
            )}
          </Panel>

          <Panel className="command-panel command-readiness">
            <SectionHeader
              action={
                <StatusBadge status={readiness.statusTone}>
                  {readiness.statusLabel}
                </StatusBadge>
              }
              eyebrow="Application availability"
              title="Current data coverage"
            />
            <p className="command-readiness__disclosure">
              {readiness.disclosure}
            </p>
            <div
              aria-label="Current application data availability"
              className="command-readiness__list"
            >
              {readiness.items.map((item) => (
                <div className="command-readiness__item" key={item.id}>
                  <div>
                    <p className="command-readiness__label">
                      {item.label}
                    </p>
                    <p className="command-readiness__detail">
                      {item.detail}
                    </p>
                  </div>
                  <StatusBadge status={item.tone}>
                    {item.value}
                  </StatusBadge>
                </div>
              ))}
            </div>
            <div className="command-readiness__actions">
              <button
                className="frontier-link-button"
                onClick={() => goTo("customers")}
                type="button"
              >
                Review source coverage
              </button>
              <button
                className="frontier-link-button"
                onClick={() => goTo("analytics")}
                type="button"
              >
                Open loaded reports
              </button>
            </div>
          </Panel>

          {primaryInsight ? (
            <Panel className="command-panel command-insight">
              <SectionHeader
                action={<StatusBadge status="neutral">{primaryInsight.confidence}% confidence</StatusBadge>}
                eyebrow="Operational insight"
                title={primaryInsight.title}
              />
              <p className="command-insight__summary">{primaryInsight.summary}</p>
              <p className="command-insight__action">{primaryInsight.actionText}</p>
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
