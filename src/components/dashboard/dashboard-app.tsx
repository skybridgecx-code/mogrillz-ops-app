"use client";

import { useEffect, useMemo, useState } from "react";
import { FulfillmentAnalyticsCards } from "@/components/dashboard/analytics/fulfillment-analytics-cards";
import { OrdersPanel } from "@/components/dashboard/orders/orders-panel";
import { getFulfillmentSummary } from "@/lib/dashboard/fulfillment-summary";
import type { FulfillmentFilter, OrderFilter } from "@/components/dashboard/orders/order-filters";

import type {
  DashboardSnapshot,
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
  if (normalized.includes("delivered") || normalized.includes("ready") || normalized.includes("healthy") || normalized.includes("live") || normalized.includes("vip")) {
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

export function DashboardApp({
  snapshot,
  dataSource,
}: {
  snapshot: DashboardSnapshot;
  dataSource: DataSourceKind;
}) {
  const [view, setView] = useState<ViewKey>("overview");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState(snapshot.orders[0]?.id ?? "");
  const [selectedInventoryId, setSelectedInventoryId] = useState(snapshot.inventory[0]?.id ?? "");
  const [selectedMenuId, setSelectedMenuId] = useState(snapshot.menu[0]?.id ?? "");
  const [selectedCustomerId, setSelectedCustomerId] = useState(snapshot.customers[0]?.id ?? "");

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

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? null;
  const selectedInventory =
    snapshot.inventory.find((item) => item.id === selectedInventoryId) ?? snapshot.inventory[0];

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

  function renderOverview() {
    return (
      <section className="view-panel active">
        <div className="kpi-grid">
          {snapshot.kpis.map((kpi) => (
            <article className="card kpi-card" key={kpi.label}>
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value">{kpi.value}</div>
              <div className="kpi-delta">{kpi.delta}</div>
            </article>
          ))}
          <article className="card kpi-card">
            <div className="kpi-label">Delivery Orders</div>
            <div className="kpi-value">{fulfillmentSummary.deliveryCount}</div>
            <div className="kpi-delta">{formatCurrency(fulfillmentSummary.deliveryRevenue)} in delivery revenue</div>
          </article>
          <article className="card kpi-card">
            <div className="kpi-label">Pickup Orders</div>
            <div className="kpi-value">{fulfillmentSummary.pickupCount}</div>
            <div className="kpi-delta">{formatCurrency(fulfillmentSummary.pickupRevenue)} in pickup revenue</div>
          </article>
        </div>

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
                  <div className="stack-item-copy">{item.notes ?? "Inventory pressure needs operator attention."}</div>
                  <div className="stack-item-meta">
                    {item.onHand} {item.unit} on hand · par {item.parLevel}
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
              {snapshot.insights.map((insight) => (
                <article className="insight-card" key={insight.id}>
                  <div className="insight-meta">
                    <div className="insight-title">{insight.title}</div>
                    <span className={`status-pill ${statusTone(insight.tone)}`}>{insight.confidence}%</span>
                  </div>
                  <div className="insight-copy">{insight.summary}</div>
                  <div className="stack-item-meta">{insight.actionText}</div>
                </article>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Campaign and Comms</p>
                <h2 className="card-title">AI channel status</h2>
              </div>
            </div>
            <div className="stack-list">
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Website Concierge</div>
                  <span className="status-pill success">Live now</span>
                </div>
                <div className="stack-item-copy">Customer-facing FAQ assistant running on the public site.</div>
              </div>
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Social Campaign Agent</div>
                  <span className="status-pill warning">Internal tool</span>
                </div>
                <div className="stack-item-copy">Weekly content generation surface for Instagram and TikTok planning.</div>
              </div>
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Voice AI Pilot</div>
                  <span className="status-pill danger">Next build</span>
                </div>
                <div className="stack-item-copy">Best next MoGrillz dogfood surface for your AI call-center services.</div>
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
        formatCurrency={formatCurrency}
        statusTone={statusTone}
      />
    );
  }

  function renderInventory() {
    const recommendation = (item: InventoryItem) => {
      if (item.status === "Low" || item.status === "Out") {
        return "Replenish before the next preorder cutoff so bowls and rolls do not lose key garnish coverage.";
      }
      if (item.status === "Watch") {
        return "Monitor through the rest of tonight and top up if the next few orders keep the same mix.";
      }
      return "Coverage is healthy. No immediate action needed beyond routine prep discipline.";
    };

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
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.inventory.map((item) => {
                    const coverage = Math.min(Math.round((item.onHand / item.parLevel) * 100), 100);
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
                        <td>{item.notes ?? "Monitor"}</td>
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
                  {recommendation(selectedInventory)}
                </div>
                <div className="detail-list">
                  <div className="detail-list-item"><span>Last updated</span><strong>{new Date(selectedInventory.lastUpdatedAt).toLocaleString()}</strong></div>
                  <div className="detail-list-item"><span>Used by</span><strong>{/onion|cilantro|cheese/i.test(selectedInventory.name) ? "Bowls and rolls" : "Core menu items"}</strong></div>
                </div>
                <div className="detail-actions">
                  <button className="topbar-action" type="button">Adjust stock</button>
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
      </section>
    );
  }

  function renderCustomers() {
    return (
      <section className="view-panel active">
        <div className="card">
          <div className="card-head">
            <div>
              <p className="card-kicker">Customers</p>
              <h2 className="card-title">Repeat behavior and trust signals</h2>
            </div>
            <button className="ghost-button" type="button">Export contacts</button>
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
                  <button className="ghost-button" onClick={() => goTo("orders")} type="button">Open orders</button>
                </div>
              </article>
            ))}
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
            deliveryCount={fulfillmentSummary.deliveryCount}
            pickupCount={fulfillmentSummary.pickupCount}
            deliveryRevenue={fulfillmentSummary.deliveryRevenue}
            pickupRevenue={fulfillmentSummary.pickupRevenue}
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

        {view === "overview" && renderOverview()}
        {view === "orders" && renderOrders()}
        {view === "inventory" && renderInventory()}
        {view === "menu" && renderMenu()}
        {view === "customers" && renderCustomers()}
        {view === "analytics" && renderAnalytics()}
        {view === "ai" && renderAi()}
      </main>
    </div>
  );
}
