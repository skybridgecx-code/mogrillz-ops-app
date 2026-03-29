"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FulfillmentAnalyticsCards } from "@/components/dashboard/analytics/fulfillment-analytics-cards";
import { OrdersPanel } from "@/components/dashboard/orders/orders-panel";
import { FulfillmentSummaryCards } from "@/components/dashboard/overview/fulfillment-summary-cards";
import { OverviewKpiGrid } from "@/components/dashboard/overview/overview-kpi-grid";
import { getFulfillmentSummary } from "@/lib/dashboard/fulfillment-summary";
import { getNextOrderStatus } from "@/lib/dashboard/order-status";
import type { FulfillmentFilter, OrderFilter } from "@/components/dashboard/orders/order-filters";

import type {
  DashboardSnapshot,
  DropReminder,
  InventoryItem,
  MenuItem,
  Order,
} from "@/types/domain";

type DataSourceKind = "mock" | "supabase";
type ViewKey = "overview" | "orders" | "inventory" | "menu" | "customers" | "analytics" | "ai";

const sectionMeta: Record<ViewKey, { title: string; copy: string }> = {
  overview: {
    title: "Overview",
    copy: "A single view of drops, orders, inventory pressure, menu health, and AI guidance.",
  },
  orders: {
    title: "Orders",
    copy: "Live queue management, customer notes, and fulfillment timing for the current drop.",
  },
  inventory: {
    title: "Inventory",
    copy: "Ingredient coverage, stock risk, and the next restock decisions before service tightens up.",
  },
  menu: {
    title: "Menu Control",
    copy: "Availability, item allocation, and what should stay featured for the next drop.",
  },
  customers: {
    title: "Customers",
    copy: "Repeat behavior, high-value buyers, and the notes that shape better retention.",
  },
  analytics: {
    title: "Analytics",
    copy: "Sales performance, item demand, and drop-to-drop trends across the operation.",
  },
  ai: {
    title: "AI Insights",
    copy: "Demand guidance, prep suggestions, automation opportunities, and operator alerts.",
  },
};

const navItems: Array<{ key: ViewKey; label: string; meta: string }> = [
  { key: "overview", label: "Overview", meta: "Everything at a glance" },
  { key: "orders", label: "Orders", meta: "Live fulfillment flow" },
  { key: "inventory", label: "Inventory", meta: "Stock and prep control" },
  { key: "menu", label: "Menu Control", meta: "Availability and allocation" },
  { key: "customers", label: "Customers", meta: "Repeat behavior and notes" },
  { key: "analytics", label: "Analytics", meta: "Revenue and trendline view" },
  { key: "ai", label: "AI Insights", meta: "Guidance and automation" },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("delivered") || normalized.includes("ready") || normalized.includes("healthy") || normalized.includes("live") || normalized.includes("vip") || normalized.includes("active")) {
    return "success";
  }
  if (normalized.includes("prep") || normalized.includes("watch") || normalized.includes("open") || normalized.includes("rising")) {
    return "warning";
  }
  if (normalized.includes("new") || normalized.includes("low") || normalized.includes("out") || normalized.includes("paused") || normalized.includes("cancel")) {
    return "danger";
  }
  return "";
}

function getOrderVolumeLabel(snapshot: DashboardSnapshot) {
  return `${snapshot.orders.length} live orders`;
}

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  generatedAt: new Date(0).toISOString(),
  drop: {
    day: "Monday",
    status: "Supabase Unavailable",
    window: "Awaiting live data",
    cutoff: "Retry when the connection is healthy",
  },
  kpis: [],
  orders: [],
  inventory: [],
  menu: [],
  customers: [],
  dropReminders: [],
  insights: [],
};

function formatReminderSource(reminder: DropReminder) {
  const parts = [reminder.source, reminder.signupLocation].filter(Boolean);
  return parts
    .map((part) => part!.replace(/[-_]+/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" · ");
}

function getInventoryImpactCopy(item: InventoryItem) {
  const linkedNames = item.linkedMenuItems.map((linkedItem) => linkedItem.name);
  const linkedCopy = linkedNames.length
    ? `Linked to ${linkedNames.join(", ")}.`
    : "No linked menu items recorded yet.";

  if (item.status === "Low" || item.status === "Out") {
    return `${linkedCopy} This item could tighten the next drop fast.`;
  }

  if (item.status === "Watch") {
    return `${linkedCopy} Coverage is workable, but there is not much slack.`;
  }

  return `${linkedCopy} Coverage is healthy for the current cycle.`;
}

export function DashboardApp({
  snapshot: initialSnapshot,
  dataSource,
  dataIssue = null,
}: {
  snapshot: DashboardSnapshot | null;
  dataSource: DataSourceKind;
  dataIssue?: string | null;
}) {
  const snapshot = initialSnapshot ?? EMPTY_SNAPSHOT;
  const router = useRouter();
  const [view, setView] = useState<ViewKey>("overview");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState(snapshot.orders[0]?.id ?? "");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusUpdatingOrderId, setStatusUpdatingOrderId] = useState<string | null>(null);
  const [selectedInventoryId, setSelectedInventoryId] = useState(snapshot.inventory[0]?.id ?? "");
  const [selectedMenuId, setSelectedMenuId] = useState(snapshot.menu[0]?.id ?? "");
  const [selectedCustomerId, setSelectedCustomerId] = useState(snapshot.customers[0]?.id ?? "");
  const [reminderActionMessage, setReminderActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncHash = () => {
      const raw = window.location.hash.replace("#", "");
      if (raw && raw in sectionMeta) {
        setView(raw as ViewKey);
      }
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const filteredOrders = useMemo(() => {
    return snapshot.orders.filter((order) => {
      const statusMatch = orderFilter === "all" || order.status.toLowerCase() === orderFilter;
      const fulfillmentMatch = fulfillmentFilter === "all" || order.fulfillmentMethod === fulfillmentFilter;
      return statusMatch && fulfillmentMatch;
    });
  }, [fulfillmentFilter, orderFilter, snapshot.orders]);

  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedOrderId("");
      return;
    }

    const stillVisible = filteredOrders.some((order) => order.id === selectedOrderId);
    if (!stillVisible) setSelectedOrderId(filteredOrders[0].id);
  }, [filteredOrders, selectedOrderId]);

  useEffect(() => {
    setStatusError(null);
  }, [selectedOrderId]);

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? null;
  const selectedInventory =
    snapshot.inventory.find((item) => item.id === selectedInventoryId) ?? snapshot.inventory[0];
  const selectedMenu = snapshot.menu.find((item) => item.id === selectedMenuId) ?? snapshot.menu[0];

  const pipeline = useMemo(() => {
    const count = (status: Order["status"]) => snapshot.orders.filter((order) => order.status === status).length;
    return [
      { label: "New Orders", count: count("New"), copy: "Fresh checkouts and unreviewed custom requests." },
      { label: "In Prep", count: count("In Prep"), copy: "Currently cooking, packing, or portioning." },
      { label: "Ready", count: count("Ready"), copy: "Can move to dispatch once routing is confirmed." },
      { label: "Delivered", count: count("Delivered"), copy: "Completed successfully in the current cycle." },
    ];
  }, [snapshot.orders]);

  const lowStockItems = useMemo(
    () => snapshot.inventory.filter((item) => item.status === "Low" || item.status === "Out"),
    [snapshot.inventory],
  );

  const inventoryDependenciesByMenuId = useMemo(() => {
    const dependencies = new Map<string, InventoryItem[]>();

    for (const item of snapshot.inventory) {
      for (const linkedMenuItem of item.linkedMenuItems) {
        const existing = dependencies.get(linkedMenuItem.id) ?? [];
        existing.push(item);
        dependencies.set(linkedMenuItem.id, existing);
      }
    }

    return dependencies;
  }, [snapshot.inventory]);

  const selectedMenuDependencies = selectedMenu
    ? inventoryDependenciesByMenuId.get(selectedMenu.id) ?? []
    : [];
  const selectedMenuRiskItems = selectedMenuDependencies.filter(
    (item) => item.status === "Low" || item.status === "Out",
  );

  const prepTargets = useMemo(
    () =>
      snapshot.menu.map((item) => ({
        title: item.name,
        copy: item.notes ?? item.description,
        meta: `Allocation target ${item.allocationLimit}%`,
        tone: item.isFeatured ? "success" : item.availability === "Watch" ? "warning" : "success",
      })),
    [snapshot.menu],
  );

  const topCustomers = useMemo(
    () =>
      [...snapshot.customers]
        .sort((a, b) => b.lifetimeValueCents - a.lifetimeValueCents)
        .slice(0, 3),
    [snapshot.customers],
  );

  const reminderSummary = useMemo(() => {
    const activeCount = snapshot.dropReminders.filter((reminder) => reminder.status === "Active").length;
    const recentCount = snapshot.dropReminders.filter((reminder) => {
      const requestedAt = new Date(reminder.lastRequestedAt).getTime();
      return Number.isFinite(requestedAt) && requestedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }).length;

    return {
      activeCount,
      recentCount,
      reminders: [...snapshot.dropReminders].sort(
        (a, b) => new Date(b.lastRequestedAt).getTime() - new Date(a.lastRequestedAt).getTime(),
      ),
    };
  }, [snapshot.dropReminders]);

  const activeReminderEmails = useMemo(
    () =>
      reminderSummary.reminders
        .filter((reminder) => reminder.status === "Active")
        .map((reminder) => reminder.email)
        .filter(Boolean),
    [reminderSummary.reminders],
  );

  const latestInsightByType = useMemo(() => {
    const sortedInsights = [...snapshot.insights].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      content: sortedInsights.find((insight) => insight.type === "content") ?? null,
      demand: sortedInsights.find((insight) => insight.type === "demand") ?? null,
      prep: sortedInsights.find((insight) => insight.type === "prep") ?? null,
    };
  }, [snapshot.insights]);

  const analyticsBars = useMemo(
    () =>
      [...snapshot.menu]
        .sort((a, b) => b.allocationLimit - a.allocationLimit)
        .map((item) => ({
          label: item.name,
          value: item.allocationLimit,
          meta: formatCurrency(item.priceCents),
        })),
    [snapshot.menu],
  );

  const orderFilters: OrderFilter[] = ["all", "new", "in prep", "ready", "delivered"];
  const fulfillmentFilters: FulfillmentFilter[] = ["all", "delivery", "pickup"];

  const fulfillmentSummary = useMemo(() => getFulfillmentSummary(snapshot.orders), [snapshot.orders]);

  const currentSection = sectionMeta[view];

  function goTo(nextView: ViewKey) {
    setView(nextView);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${nextView}`);
    }
  }

  async function handleAdvanceOrderStatus(orderId: string, nextStatus: Order["status"]) {
    const currentOrder = snapshot.orders.find((order) => order.id === orderId);

    if (!currentOrder) {
      setStatusError("Order could not be found.");
      return;
    }

    const expectedNextStatus = getNextOrderStatus(currentOrder.status);
    if (!expectedNextStatus || expectedNextStatus !== nextStatus) {
      setStatusError("That status change is no longer available.");
      return;
    }

    setStatusError(null);
    setStatusUpdatingOrderId(orderId);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Unable to update the order status.");
      }

      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the order status.";
      setStatusError(message);
    } finally {
      setStatusUpdatingOrderId(null);
    }
  }

  function renderOverview() {
    return (
      <section className="view-panel active">
        <OverviewKpiGrid kpis={snapshot.kpis}>
          <FulfillmentSummaryCards
            fulfillmentSummary={fulfillmentSummary}
            formatCurrency={formatCurrency}
          />
        </OverviewKpiGrid>

        <div className="overview-grid">
          <article className="card card-span-2">
            <div className="card-head">
              <div>
                <p className="card-kicker">Drop Control</p>
                <h2 className="card-title">Today at a glance</h2>
              </div>
              <div className="status-badge">{snapshot.drop.day} {snapshot.drop.status}</div>
            </div>
            <div className="pipeline-grid">
              {pipeline.map((stage) => (
                <div className="pipeline-card" key={stage.label}>
                  <div className="pipeline-count">{stage.count}</div>
                  <div className="pipeline-label">{stage.label}</div>
                  <div className="pipeline-copy">{stage.copy}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Quick Actions</p>
                <h2 className="card-title">Go where you need</h2>
              </div>
            </div>
            <div className="quick-actions">
              {[
                { title: "Open live orders", copy: "Review new tickets, notes, and ready-to-dispatch orders.", target: "orders" as const },
                { title: "Review low stock", copy: "Jump straight into the ingredients most likely to pinch service.", target: "inventory" as const },
                { title: "Adjust menu allocation", copy: "Rebalance item counts and protect premium items.", target: "menu" as const },
                { title: "Read AI briefing", copy: "See prep guidance, demand shifts, and automation ideas.", target: "ai" as const },
              ].map((action) => (
                <button className="action-card" key={action.title} onClick={() => goTo(action.target)} type="button">
                  <strong>{action.title}</strong>
                  <span>{action.copy}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Inventory Pressure</p>
                <h2 className="card-title">Low-stock alerts</h2>
              </div>
              <button className="ghost-button" onClick={() => goTo("inventory")} type="button">Open inventory</button>
            </div>
            <div className="stack-list">
              {lowStockItems.map((item) => (
                <div className="stack-item" key={item.id}>
                  <div className="stack-item-head">
                    <div className="stack-item-title">{item.name}</div>
                    <span className={`status-pill ${statusTone(item.status)}`}>{item.status}</span>
                  </div>
                  <div className="stack-item-copy">{getInventoryImpactCopy(item)}</div>
                  <div className="stack-item-meta">
                    {item.onHand} {item.unit} on hand · par {item.parLevel}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Prep Targets</p>
                <h2 className="card-title">Next drop guidance</h2>
              </div>
              <button className="ghost-button" onClick={() => goTo("menu")} type="button">Open menu control</button>
            </div>
            <div className="stack-list">
              {prepTargets.map((item) => (
                <div className="stack-item" key={item.title}>
                  <div className="stack-item-head">
                    <div className="stack-item-title">{item.title}</div>
                    <span className={`status-pill ${statusTone(item.tone)}`}>{item.meta}</span>
                  </div>
                  <div className="stack-item-copy">{item.copy}</div>
                </div>
              ))}
            </div>
          </article>

          <article className="card card-span-2">
            <div className="card-head">
              <div>
                <p className="card-kicker">AI Briefing</p>
                <h2 className="card-title">What needs attention</h2>
              </div>
              <button className="ghost-button" onClick={() => goTo("ai")} type="button">Open AI layer</button>
            </div>
            <div className="insight-grid">
              {snapshot.insights.length ? (
                snapshot.insights.map((insight) => (
                  <article className="insight-card" key={insight.id}>
                    <div className="insight-meta">
                      <div className="insight-title">{insight.title}</div>
                      <span className={`status-pill ${statusTone(insight.tone)}`}>{insight.confidence}%</span>
                    </div>
                    <div className="insight-copy">{insight.summary}</div>
                    <div className="stack-item-meta">{insight.actionText}</div>
                  </article>
                ))
              ) : (
                <article className="insight-card">
                  <div className="insight-meta">
                    <div className="insight-title">No live AI insights</div>
                    <span className="status-pill">Awaiting signal</span>
                  </div>
                  <div className="insight-copy">The dashboard will surface prep, demand, ops, and content guidance here once insight rows are available.</div>
                  <div className="stack-item-meta">Check the insights table or refresh after new sync activity.</div>
                </article>
              )}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Campaign and Comms</p>
                <h2 className="card-title">Live signal mix</h2>
              </div>
            </div>
            <div className="stack-list">
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Content Signal</div>
                  <span className={`status-pill ${latestInsightByType.content ? statusTone(latestInsightByType.content.tone) : ""}`}>
                    {latestInsightByType.content ? `${latestInsightByType.content.confidence}% confidence` : "No content signal"}
                  </span>
                </div>
                <div className="stack-item-copy">
                  {latestInsightByType.content?.summary ?? "No live content insight is available yet for campaign guidance."}
                </div>
              </div>
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Demand Signal</div>
                  <span className={`status-pill ${latestInsightByType.demand ? statusTone(latestInsightByType.demand.tone) : ""}`}>
                    {latestInsightByType.demand ? `${latestInsightByType.demand.confidence}% confidence` : "No demand signal"}
                  </span>
                </div>
                <div className="stack-item-copy">
                  {latestInsightByType.demand?.summary ?? "No live demand signal is available yet from the current orders feed."}
                </div>
              </div>
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Prep Signal</div>
                  <span className={`status-pill ${latestInsightByType.prep ? statusTone(latestInsightByType.prep.tone) : ""}`}>
                    {latestInsightByType.prep ? `${latestInsightByType.prep.confidence}% confidence` : "No prep signal"}
                  </span>
                </div>
                <div className="stack-item-copy">
                  {latestInsightByType.prep?.summary ?? "No live prep signal is available yet from the current inventory and order mix."}
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>
    );
  }

  function renderOrders() {
    return (
      <OrdersPanel
        orders={snapshot.orders}
        filteredOrders={filteredOrders}
        selectedOrder={selectedOrder}
        selectedOrderId={selectedOrderId}
        orderFilter={orderFilter}
        fulfillmentFilter={fulfillmentFilter}
        orderFilters={orderFilters}
        fulfillmentFilters={fulfillmentFilters}
        onOrderFilterChange={setOrderFilter}
        onFulfillmentFilterChange={setFulfillmentFilter}
        onSelectOrder={setSelectedOrderId}
        onResetFilters={() => {
          setOrderFilter("all");
          setFulfillmentFilter("all");
        }}
        onOpenInventory={() => goTo("inventory")}
        onOpenCustomer={() => goTo("customers")}
        onAdvanceStatus={handleAdvanceOrderStatus}
        statusError={statusError}
        statusUpdating={statusUpdatingOrderId === selectedOrder?.id}
        formatCurrency={formatCurrency}
        statusTone={statusTone}
      />
    );
  }

  function renderInventory() {
    return (
      <section className="view-panel active">
        <div className="content-grid">
          <article className="card card-span-2">
            <div className="card-head">
              <div>
                <p className="card-kicker">Inventory</p>
                <h2 className="card-title">Current stock health</h2>
              </div>
              <button className="ghost-button" type="button">Add adjustment</button>
            </div>
            <div className="table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>On Hand</th>
                    <th>Par</th>
                    <th>Coverage</th>
                    <th>Status</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.inventory.map((item) => {
                    const coverage = item.parLevel > 0
                      ? Math.min(Math.round((item.onHand / item.parLevel) * 100), 100)
                      : 100;
                    return (
                      <tr
                        className={item.id === selectedInventoryId ? "is-selected" : ""}
                        key={item.id}
                        onClick={() => setSelectedInventoryId(item.id)}
                      >
                        <td><strong>{item.name}</strong></td>
                        <td>{item.onHand} {item.unit}</td>
                        <td>{item.parLevel} {item.unit}</td>
                        <td>
                          <div className="metric-bar">
                            <div className="metric-track">
                              <div
                                className={`metric-fill ${item.status === "Low" || item.status === "Out" ? "red" : item.status === "Healthy" ? "green" : ""}`}
                                style={{ width: `${coverage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td><span className={`status-pill ${statusTone(item.status)}`}>{item.status}</span></td>
                        <td>
                          {item.notes ?? "Inventory pressure needs operator attention."}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="detail-card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Restock Logic</p>
                <h2 className="card-title">{selectedInventory?.name ?? "Next move"}</h2>
              </div>
            </div>
            {selectedInventory ? (
              <div className="detail-panel">
                <div className="detail-hero">
                  <h3>{selectedInventory.status}</h3>
                  <p>
                    {selectedInventory.onHand} {selectedInventory.unit} on hand against a par of {selectedInventory.parLevel}.
                  </p>
                </div>
                <div className="detail-note">
                  <strong>Recommended next move</strong>
                  {selectedInventory.status === "Low" || selectedInventory.status === "Out"
                    ? "Replenish before the next preorder cutoff so bowls and rolls do not lose key garnish coverage."
                    : selectedInventory.status === "Watch"
                      ? "Monitor through the rest of tonight and top up if the next few orders keep the same mix."
                      : "Coverage is healthy. No immediate action needed beyond routine prep discipline."}
                </div>
                <div className="detail-list">
                  <div className="detail-list-item"><span>Last updated</span><strong>{new Date(selectedInventory.lastUpdatedAt).toLocaleString()}</strong></div>
                  <div className="detail-list-item">
                    <span>Linked menu signal</span>
                    <strong>
                      {selectedInventory.linkedMenuItems.length
                        ? selectedInventory.linkedMenuItems.map((item) => item.name).join(", ")
                        : "No linked menu items recorded yet"}
                    </strong>
                  </div>
                  <div className="detail-list-item">
                    <span>Recorded context</span>
                    <strong>{selectedInventory.notes ?? "No prep note is recorded for this item yet."}</strong>
                  </div>
                </div>
                <div className="detail-note">
                  <strong>Update stock and context</strong>
                  Keep the queue honest by updating what is actually on hand before the next prep window tightens up.
                </div>
                <div className="detail-actions">
                  <button className="ghost-button" onClick={() => goTo("menu")} type="button">See menu impact</button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    );
  }

  function renderMenu() {
    return (
      <section className="view-panel active">
        <div className="content-grid">
          <div className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Menu Control</p>
                <h2 className="card-title">Allocation and availability</h2>
              </div>
              <button className="ghost-button" type="button">Publish next drop</button>
            </div>
            <div className="menu-control-grid">
              {snapshot.menu.map((item: MenuItem) => (
                <article
                  className={`menu-card ${item.id === selectedMenuId ? "is-selected" : ""}`}
                  key={item.id}
                  onClick={() => setSelectedMenuId(item.id)}
                >
                  <div className="menu-card-meta">
                    <div>
                      <div className="menu-card-title">{item.name}</div>
                      <div className="stack-item-meta">{item.category} · {formatCurrency(item.priceCents)}</div>
                    </div>
                    <span className={`status-pill ${statusTone(item.availability)}`}>{item.availability}</span>
                  </div>
                  <div className="menu-card-copy">{item.description}</div>
                  <div className="metric-bar">
                    <label>
                      <span className="stack-item-meta">Allocation fill</span>
                      <span className="stack-item-meta">{item.allocationLimit}%</span>
                    </label>
                    <div className="metric-track">
                      <div className="metric-fill" style={{ width: `${item.allocationLimit}%` }} />
                    </div>
                  </div>
                  <div className="menu-card-footer">
                    <span className="chip">{item.isFeatured ? "Featured" : "Menu"}</span>
                    <span className="stack-item-meta">{item.notes}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="detail-card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Merchandising Control</p>
                <h2 className="card-title">{selectedMenu?.name ?? "Select a menu item"}</h2>
              </div>
            </div>
            {selectedMenu ? (
              <div className="detail-panel">
                <div className="detail-hero">
                  <h3>{selectedMenu.availability}</h3>
                  <p>
                    {formatCurrency(selectedMenu.priceCents)} · {selectedMenu.category} · allocation target {selectedMenu.allocationLimit}%.
                  </p>
                </div>
                <div className="detail-note">
                  <strong>Current menu read</strong>
                  {selectedMenu.description}
                </div>
                <div className="detail-list">
                  <div className="detail-list-item">
                    <span>Ingredient dependencies</span>
                    <strong>
                      {selectedMenuDependencies.length
                        ? selectedMenuDependencies.map((item) => item.name).join(", ")
                        : "No linked inventory items recorded yet"}
                    </strong>
                  </div>
                  <div className="detail-list-item">
                    <span>Current inventory risk</span>
                    <strong>
                      {selectedMenuRiskItems.length
                        ? `${selectedMenuRiskItems.length} flagged ingredient${selectedMenuRiskItems.length === 1 ? "" : "s"}`
                        : selectedMenuDependencies.length
                          ? "No linked ingredient is currently flagged"
                          : "No linked ingredient is currently flagged"}
                    </strong>
                  </div>
                  <div className="detail-list-item">
                    <span>Current merchandising note</span>
                    <strong>{selectedMenu.notes ?? "No internal merchandising note yet."}</strong>
                  </div>
                </div>
                <div className="detail-note">
                  <strong>Update live menu controls</strong>
                  Save only what is true for the current drop so the dashboard matches the real operational plan.
                </div>
                <div className="detail-actions">
                  <button className="ghost-button" onClick={() => goTo("inventory")} type="button">
                    Open Inventory
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    );
  }

  function renderCustomers() {
    const reminderDraftBody = [
      "You asked to hear about the next MoGrillz drop.",
      "",
      "We will send the next menu reveal and reminder before the drop opens.",
      "",
      "Reply here if you have any larger-order questions for the upcoming drop.",
      "",
      "Chef Mo",
      "MoGrillz",
    ].join("\n");

    async function handleCopyReminderEmails() {
      if (!activeReminderEmails.length) return;

      const text = activeReminderEmails.join(", ");

      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else if (typeof document !== "undefined") {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "true");
          textarea.style.position = "absolute";
          textarea.style.left = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          textarea.remove();
        }

        setReminderActionMessage(`Copied ${activeReminderEmails.length} active reminder email${activeReminderEmails.length === 1 ? "" : "s"}.`);
      } catch {
        setReminderActionMessage("Could not copy reminder emails on this device.");
      }
    }

    function handleOpenReminderDraft() {
      if (!activeReminderEmails.length || typeof window === "undefined") return;

      const mailto = new URL("mailto:");
      mailto.searchParams.set("bcc", activeReminderEmails.join(","));
      mailto.searchParams.set("subject", "MoGrillz Next Drop Reminder");
      mailto.searchParams.set("body", reminderDraftBody);
      window.location.href = mailto.toString();
      setReminderActionMessage(`Opened a draft for ${activeReminderEmails.length} active reminder email${activeReminderEmails.length === 1 ? "" : "s"}.`);
    }

    return (
      <section className="view-panel active">
        <div className="analytics-grid">
          <div className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Customers</p>
                <h2 className="card-title">Repeat behavior and trust signals</h2>
              </div>
              <div className="status-badge">{snapshot.customers.length} tracked</div>
            </div>
            <div className="customer-grid">
              {snapshot.customers.map((customer) => (
                <article
                  className={`customer-card ${customer.id === selectedCustomerId ? "is-selected" : ""}`}
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                >
                  <div className="customer-card-meta">
                    <div>
                      <div className="customer-card-title">{customer.name}</div>
                      <div className="stack-item-meta">{customer.zone} · {customer.totalOrders} orders</div>
                    </div>
                    <span className={`status-pill ${statusTone(customer.loyaltyTier)}`}>{customer.loyaltyTier}</span>
                  </div>
                  <div className="customer-card-copy">{customer.notes ?? "No customer notes yet."}</div>
                  <div className="customer-card-footer">
                    <span className="chip">{formatCurrency(customer.lifetimeValueCents)} lifetime</span>
                    <button className="ghost-button" onClick={() => goTo("orders")} type="button">Open orders view</button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Drop Reminders</p>
                <h2 className="card-title">Captured next-drop demand</h2>
              </div>
              <div className="status-badge">{reminderSummary.activeCount} active</div>
            </div>
            <div className="customer-card-footer" style={{ marginTop: 0, marginBottom: 16 }}>
              <span className="chip">{reminderSummary.recentCount} requested this week</span>
              <span className="chip">{snapshot.dropReminders.length} total signups</span>
            </div>
            <div className="detail-actions" style={{ marginBottom: 16 }}>
              <button
                className="ghost-button"
                disabled={!activeReminderEmails.length}
                onClick={handleCopyReminderEmails}
                type="button"
              >
                Copy active emails
              </button>
              <button
                className="ghost-button"
                disabled={!activeReminderEmails.length}
                onClick={handleOpenReminderDraft}
                type="button"
              >
                Open outreach draft
              </button>
            </div>
            {reminderActionMessage ? (
              <div className="detail-note" style={{ marginBottom: 16 }}>
                <strong>Reminder action</strong>
                {reminderActionMessage}
              </div>
            ) : null}
            {reminderSummary.reminders.length ? (
              <div className="customer-grid">
                {reminderSummary.reminders.map((reminder) => (
                  <article className="customer-card" key={reminder.id}>
                    <div className="customer-card-meta">
                      <div>
                        <div className="customer-card-title">{reminder.email}</div>
                        <div className="stack-item-meta">{formatReminderSource(reminder) || "Website signup"}</div>
                      </div>
                      <span className={`status-pill ${statusTone(reminder.status)}`}>{reminder.status}</span>
                    </div>
                    <div className="customer-card-copy">{reminder.notes ?? "No internal note recorded for this signup yet."}</div>
                    <div className="customer-card-footer">
                      <span className="chip">{new Date(reminder.lastRequestedAt).toLocaleString()}</span>
                      <a className="ghost-button" href={`mailto:${reminder.email}`} onClick={(event) => event.stopPropagation()}>
                        Email contact
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="detail-note">
                <strong>No reminder signups yet.</strong>
                The success-page email capture is live, so new signups will land here as customers opt in after checkout.
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderAnalytics() {
    const maxValue = Math.max(...analyticsBars.map((bar) => bar.value), 1);

    return (
      <section className="view-panel active">
        <div className="analytics-grid">
          <article className="card card-span-2">
            <div className="card-head">
              <div>
                <p className="card-kicker">Revenue Trend</p>
                <h2 className="card-title">Current menu strength</h2>
              </div>
              <div className="status-badge">{getOrderVolumeLabel(snapshot)}</div>
            </div>
            <div className="bars-grid">
              {analyticsBars.map((bar) => (
                <article className="bar-card" key={bar.label}>
                  <div className="bar-label">{bar.label}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.round((bar.value / maxValue) * 100)}%` }} />
                  </div>
                  <div className="bar-value">{bar.value}% allocation · {bar.meta}</div>
                </article>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Best Customers</p>
                <h2 className="card-title">Highest value</h2>
              </div>
            </div>
            <div className="stack-list">
              {topCustomers.map((customer) => (
                <div className="stack-item" key={customer.id}>
                  <div className="stack-item-head">
                    <div className="stack-item-title">{customer.name}</div>
                    <span className={`status-pill ${statusTone(customer.loyaltyTier)}`}>{customer.loyaltyTier}</span>
                  </div>
                  <div className="stack-item-copy">{customer.notes}</div>
                  <div className="stack-item-meta">{formatCurrency(customer.lifetimeValueCents)} lifetime spend</div>
                </div>
              ))}
            </div>
          </article>

          <FulfillmentAnalyticsCards
            fulfillmentSummary={fulfillmentSummary}
            formatCurrency={formatCurrency}
          />

          <article className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Operational Notes</p>
                <h2 className="card-title">What changed</h2>
              </div>
            </div>
            <div className="stack-list">
              {snapshot.insights.map((insight) => (
                <div className="stack-item" key={insight.id}>
                  <div className="stack-item-head">
                    <div className="stack-item-title">{insight.title}</div>
                    <span className={`status-pill ${statusTone(insight.tone)}`}>{insight.confidence}%</span>
                  </div>
                  <div className="stack-item-copy">{insight.summary}</div>
                  <div className="stack-item-meta">{insight.actionText}</div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    );
  }

  function renderAi() {
    return (
      <section className="view-panel active">
        <div className="content-grid">
          <article className="card card-span-2">
            <div className="card-head">
              <div>
                <p className="card-kicker">AI Insights</p>
                <h2 className="card-title">Decision support</h2>
              </div>
              <a className="ghost-button" href="https://mogrillzva.vercel.app/social-agent.html" rel="noreferrer" target="_blank">
                Open social agent
              </a>
            </div>
            <div className="insight-grid">
              {snapshot.insights.map((insight) => (
                <article className="insight-card" key={insight.id}>
                  <div className="insight-meta">
                    <div className="insight-title">{insight.title}</div>
                    <span className={`status-pill ${statusTone(insight.tone)}`}>{insight.confidence}%</span>
                  </div>
                  <div className="insight-copy">{insight.summary}</div>
                  <div className="detail-note">
                    <strong>Recommended action</strong>
                    {insight.actionText}
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Automation Stack</p>
                <h2 className="card-title">Internal AI surfaces</h2>
              </div>
            </div>
            <div className="stack-list">
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Website Concierge</div>
                  <span className="status-pill success">Live now</span>
                </div>
                <div className="stack-item-copy">Public FAQ assistant on the MoGrillz site.</div>
              </div>
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Social Campaign Agent</div>
                  <span className="status-pill warning">Ready once secret is configured</span>
                </div>
                <div className="stack-item-copy">Internal campaign pack generator for Instagram and TikTok.</div>
              </div>
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">SMS Reminder Layer</div>
                  <span className="status-pill warning">Recommended next build</span>
                </div>
                <div className="stack-item-copy">Best next lightweight automation after campaign generation.</div>
              </div>
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Voice AI Call Center</div>
                  <span className="status-pill danger">Prototype next</span>
                </div>
                <div className="stack-item-copy">Best long-term MoGrillz dogfood for your AI services offer.</div>
              </div>
            </div>
          </article>
        </div>
      </section>
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-kicker">Operator Console</div>
          <div className="brand-mark">
            <span className="brand-mo">MO</span>
            <span className="brand-grillz">GRILLZ</span>
          </div>
          <div className="brand-sub">Ops App</div>
        </div>

        <nav aria-label="Dashboard sections" className="nav-stack">
          {navItems.map((item) => (
            <button
              className={`nav-link ${view === item.key ? "active" : ""}`}
              key={item.key}
              onClick={() => goTo(item.key)}
              type="button"
            >
              <span className="nav-link-label">{item.label}</span>
              <span className="nav-link-meta">{item.meta}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-label">Connected Surfaces</div>
          <a className="surface-link" href="https://mogrillzva.vercel.app" rel="noreferrer" target="_blank">Public Site</a>
          <a className="surface-link" href="https://mogrillzva.vercel.app/social-agent.html" rel="noreferrer" target="_blank">Social Agent</a>
          <div className="surface-link">Data Source: {dataSource === "mock" ? "Mock Mode" : "Supabase"}</div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="topbar-kicker">MoGrillz Ops</div>
            <h1 className="topbar-title">{currentSection.title}</h1>
            <p className="topbar-copy">{currentSection.copy}</p>
          </div>

          <div className="topbar-rail">
            <div className="topbar-pill">
              <span className="pill-label">Current Drop</span>
              <strong>{snapshot.drop.day}</strong>
            </div>
            <div className="topbar-pill topbar-pill-accent">
              <span className="pill-label">Status</span>
              <strong>{snapshot.drop.status}</strong>
            </div>
            <button className="topbar-action" onClick={() => goTo("orders")} type="button">
              Open Live Queue
            </button>
          </div>
        </header>
        {dataIssue && !initialSnapshot ? (
          <section className="view-panel active">
            <article className="card">
              <div className="card-head">
                <div>
                  <p className="card-kicker">Data Health</p>
                  <h2 className="card-title">Supabase data unavailable</h2>
                </div>
                <div className="status-badge">Connection issue</div>
              </div>
              <div className="detail-note">
                <strong>Live dashboard data could not be loaded.</strong>
                {dataIssue}
              </div>
              <div className="detail-actions">
                <button className="ghost-button" onClick={() => router.refresh()} type="button">
                  Retry load
                </button>
              </div>
            </article>
          </section>
        ) : (
          <>
            {view === "overview" && renderOverview()}
            {view === "orders" && renderOrders()}
            {view === "inventory" && renderInventory()}
            {view === "menu" && renderMenu()}
            {view === "customers" && renderCustomers()}
            {view === "analytics" && renderAnalytics()}
            {view === "ai" && renderAi()}
          </>
        )}
      </main>
    </div>
  );
}
