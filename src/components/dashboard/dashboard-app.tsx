"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { FulfillmentAnalyticsCards } from "@/components/dashboard/analytics/fulfillment-analytics-cards";
import { OrdersPanel } from "@/components/dashboard/orders/orders-panel";
import { FulfillmentSummaryCards } from "@/components/dashboard/overview/fulfillment-summary-cards";
import { OverviewKpiGrid } from "@/components/dashboard/overview/overview-kpi-grid";
import { getFulfillmentSummary } from "@/lib/dashboard/fulfillment-summary";
import { getNextOrderStatus } from "@/lib/dashboard/order-status";
import type { FulfillmentFilter, OrderFilter } from "@/components/dashboard/orders/order-filters";
import type { DashboardSnapshot, EmailUpdate, InventoryItem, MenuItem, Order } from "@/types/domain";

type DataSourceKind = "mock" | "supabase";
type ViewKey = "overview" | "orders" | "inventory" | "menu" | "customers" | "analytics" | "ai";

type MenuEditorState = {
  slug: string;
  name: string;
  category: string;
  priceCents: string;
  availability: MenuItem["availability"];
  allocationLimit: string;
  description: string;
  imageUrl: string;
  sortOrder: string;
  isFeatured: boolean;
  notes: string;
};

const sectionMeta: Record<ViewKey, { title: string; copy: string }> = {
  overview: {
    title: "Overview",
    copy: "Next-day pickup orders, menu health, prep pressure, and the next operator move.",
  },
  orders: {
    title: "Orders",
    copy: "Pickup queue management across New Request, In Prep, Ready For Pickup, and Completed.",
  },
  inventory: {
    title: "Inventory",
    copy: "Ingredient coverage, stock risk, and the prep decisions shaping service quality.",
  },
  menu: {
    title: "Menu Control",
    copy: "The live customer menu now runs from here. Edit items, pricing, ordering, and visibility without code changes.",
  },
  customers: {
    title: "Customers",
    copy: "Tracked customers and email update signups for retention and reactivation.",
  },
  analytics: {
    title: "Analytics",
    copy: "Sales mix, fulfillment signals, and what the current menu is actually doing.",
  },
  ai: {
    title: "AI Insights",
    copy: "Prep guidance, operator warnings, and content ideas tied to the current operation.",
  },
};

const navItems: Array<{ key: ViewKey; label: string; meta: string }> = [
  { key: "overview", label: "Overview", meta: "Operations snapshot" },
  { key: "orders", label: "Orders", meta: "Live pickup queue" },
  { key: "inventory", label: "Inventory", meta: "Stock and prep control" },
  { key: "menu", label: "Menu Control", meta: "Customer-facing menu CMS" },
  { key: "customers", label: "Customers", meta: "Accounts and email updates" },
  { key: "analytics", label: "Analytics", meta: "Revenue and demand view" },
  { key: "ai", label: "AI Insights", meta: "Guidance and automations" },
];

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  generatedAt: new Date(0).toISOString(),
  operations: {
    serviceDateLabel: "Upcoming",
    status: "Supabase Unavailable",
    queueSummary: "Retry when the connection is healthy",
    serviceWindow: "Pickup details confirmed after checkout",
  },
  kpis: [],
  orders: [],
  inventory: [],
  menu: [],
  customers: [],
  emailUpdates: [],
  insights: [],
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("picked up") || normalized.includes("completed") || normalized.includes("healthy") || normalized.includes("live") || normalized.includes("vip") || normalized.includes("active")) {
    return "success";
  }
  if (normalized.includes("new") || normalized.includes("prep") || normalized.includes("ready") || normalized.includes("watch") || normalized.includes("open") || normalized.includes("rising")) {
    return "warning";
  }
  if (normalized.includes("low") || normalized.includes("out") || normalized.includes("paused") || normalized.includes("cancel")) {
    return "danger";
  }
  return "";
}

function formatReminderSource(update: EmailUpdate) {
  const parts = [update.source, update.signupLocation].filter(Boolean);
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
    return `${linkedCopy} This ingredient can pinch the live pickup queue fast.`;
  }

  if (item.status === "Watch") {
    return `${linkedCopy} Coverage is workable, but there is not much slack.`;
  }

  return `${linkedCopy} Coverage is healthy for the current service flow.`;
}

function menuToDraft(item?: MenuItem | null): MenuEditorState {
  return {
    slug: item?.slug ?? "",
    name: item?.name ?? "",
    category: item?.category ?? "",
    priceCents: item ? String(item.priceCents) : "",
    availability: item?.availability ?? "Live",
    allocationLimit: item ? String(item.allocationLimit) : "0",
    description: item?.description ?? "",
    imageUrl: item?.imageUrl ?? "",
    sortOrder: item ? String(item.sortOrder) : "0",
    isFeatured: item?.isFeatured ?? false,
    notes: item?.notes ?? "",
  };
}

function getOrderVolumeLabel(snapshot: DashboardSnapshot) {
  return `${snapshot.orders.length} live orders`;
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
  const router = useRouter();
  const snapshot = initialSnapshot ?? EMPTY_SNAPSHOT;
  const [view, setView] = useState<ViewKey>("overview");
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState<FulfillmentFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState(snapshot.orders[0]?.id ?? "");
  const [selectedInventoryId, setSelectedInventoryId] = useState(snapshot.inventory[0]?.id ?? "");
  const [selectedMenuId, setSelectedMenuId] = useState(snapshot.menu[0]?.id ?? "");
  const [selectedCustomerId, setSelectedCustomerId] = useState(snapshot.customers[0]?.id ?? "");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusUpdatingOrderId, setStatusUpdatingOrderId] = useState<string | null>(null);
  const [menuMessage, setMenuMessage] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuSaving, setMenuSaving] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [menuDraft, setMenuDraft] = useState<MenuEditorState>(() => menuToDraft(snapshot.menu[0] ?? null));
  const [createDraft, setCreateDraft] = useState<MenuEditorState>({
    slug: "",
    name: "",
    category: "signature",
    priceCents: "",
    availability: "Live",
    allocationLimit: "0",
    description: "",
    imageUrl: "",
    sortOrder: "0",
    isFeatured: false,
    notes: "",
  });

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

  const filteredOrders = useMemo(
    () => {
      const statusPriority: Record<Order["status"], number> = {
        New: 0,
        "In Prep": 1,
        Ready: 2,
        "Picked Up": 3,
        Cancelled: 4,
      };

      const toTimestamp = (value: string) => {
        const parsed = new Date(value);
        return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
      };

      return snapshot.orders
      .filter((order) => {
        const statusMatch = orderFilter === "all" || order.status.toLowerCase() === orderFilter;
        const fulfillmentMatch = fulfillmentFilter === "all" || order.fulfillmentMethod === fulfillmentFilter;
        return statusMatch && fulfillmentMatch;
      })
      .sort((left, right) => {
        const statusDelta = (statusPriority[left.status] ?? 99) - (statusPriority[right.status] ?? 99);
        if (statusDelta !== 0) return statusDelta;

        const serviceDateLeft = left.serviceDate ? toTimestamp(`${left.serviceDate}T00:00:00`) : Number.MAX_SAFE_INTEGER;
        const serviceDateRight = right.serviceDate ? toTimestamp(`${right.serviceDate}T00:00:00`) : Number.MAX_SAFE_INTEGER;
        if (serviceDateLeft !== serviceDateRight) return serviceDateLeft - serviceDateRight;

        return toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
      });
    },
    [fulfillmentFilter, orderFilter, snapshot.orders],
  );

  useEffect(() => {
    if (!filteredOrders.length) {
      setSelectedOrderId("");
      return;
    }

    const stillVisible = filteredOrders.some((order) => order.id === selectedOrderId);
    if (!stillVisible) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedOrderId]);

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId) ?? filteredOrders[0] ?? null;
  const selectedInventory = snapshot.inventory.find((item) => item.id === selectedInventoryId) ?? snapshot.inventory[0] ?? null;
  const selectedMenu = snapshot.menu.find((item) => item.id === selectedMenuId) ?? snapshot.menu[0] ?? null;
  const selectedCustomer = snapshot.customers.find((item) => item.id === selectedCustomerId) ?? snapshot.customers[0] ?? null;

  useEffect(() => {
    setMenuDraft(menuToDraft(selectedMenu));
    setMenuMessage(null);
    setMenuError(null);
  }, [selectedMenu]);

  const orderFilters: OrderFilter[] = ["all", "new", "in prep", "ready", "picked up"];
  const fulfillmentFilters: FulfillmentFilter[] = ["all", "pickup"];
  const fulfillmentSummary = useMemo(() => getFulfillmentSummary(snapshot.orders), [snapshot.orders]);
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

  const selectedMenuDependencies = selectedMenu ? inventoryDependenciesByMenuId.get(selectedMenu.id) ?? [] : [];
  const selectedMenuRiskItems = selectedMenuDependencies.filter((item) => item.status === "Low" || item.status === "Out");

  const prepTargets = useMemo(
    () =>
      [...snapshot.menu]
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .slice(0, 6),
    [snapshot.menu],
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

  const emailUpdateSummary = useMemo(() => {
    const activeCount = snapshot.emailUpdates.filter((update) => update.status === "Active").length;
    const recentCount = snapshot.emailUpdates.filter((update) => {
      const requestedAt = new Date(update.lastRequestedAt).getTime();
      return Number.isFinite(requestedAt) && requestedAt >= Date.now() - 7 * 24 * 60 * 60 * 1000;
    }).length;

    return {
      activeCount,
      recentCount,
      updates: [...snapshot.emailUpdates].sort(
        (a, b) => new Date(b.lastRequestedAt).getTime() - new Date(a.lastRequestedAt).getTime(),
      ),
    };
  }, [snapshot.emailUpdates]);

  const activeUpdateEmails = useMemo(
    () =>
      emailUpdateSummary.updates
        .filter((update) => update.status === "Active")
        .map((update) => update.email)
        .filter(Boolean),
    [emailUpdateSummary.updates],
  );

  function goTo(nextView: ViewKey) {
    setView(nextView);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${nextView}`);
    }
  }

  function updateMenuDraft<K extends keyof MenuEditorState>(key: K, value: MenuEditorState[K]) {
    setMenuDraft((current) => ({ ...current, [key]: value }));
    if (menuError) setMenuError(null);
    if (menuMessage) setMenuMessage(null);
  }

  function updateCreateDraft<K extends keyof MenuEditorState>(key: K, value: MenuEditorState[K]) {
    setCreateDraft((current) => ({ ...current, [key]: value }));
    if (menuError) setMenuError(null);
    if (menuMessage) setMenuMessage(null);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Unable to update the order status.");
      }

      router.refresh();
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Unable to update the order status.");
    } finally {
      setStatusUpdatingOrderId(null);
    }
  }

  async function saveMenuItem(itemId: string) {
    setMenuSaving(true);
    setMenuError(null);
    setMenuMessage(null);

    try {
      const response = await fetch(`/api/menu/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...menuDraft,
          priceCents: Number(menuDraft.priceCents),
          allocationLimit: Number(menuDraft.allocationLimit),
          sortOrder: Number(menuDraft.sortOrder),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to save menu item.");
      }

      setMenuMessage("Live menu item saved.");
      router.refresh();
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : "Unable to save menu item.");
    } finally {
      setMenuSaving(false);
    }
  }

  async function createMenuItem() {
    setCreateSaving(true);
    setMenuError(null);
    setMenuMessage(null);

    try {
      const response = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createDraft,
          priceCents: Number(createDraft.priceCents),
          allocationLimit: Number(createDraft.allocationLimit),
          sortOrder: Number(createDraft.sortOrder),
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; id?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to create menu item.");
      }

      setCreateDraft({
        slug: "",
        name: "",
        category: "signature",
        priceCents: "",
        availability: "Live",
        allocationLimit: "0",
        description: "",
        imageUrl: "",
        sortOrder: "0",
        isFeatured: false,
        notes: "",
      });
      setMenuMessage("New menu item created.");
      if (payload?.id) setSelectedMenuId(payload.id);
      router.refresh();
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : "Unable to create menu item.");
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleCopyUpdateEmails() {
    if (!activeUpdateEmails.length) return;

    const text = activeUpdateEmails.join(", ");
    try {
      await navigator.clipboard.writeText(text);
      setMenuMessage(`Copied ${activeUpdateEmails.length} active email update contacts.`);
    } catch {
      setMenuError("Could not copy email update contacts on this device.");
    }
  }

  function handleOpenUpdateDraft() {
    if (!activeUpdateEmails.length || typeof window === "undefined") return;

    const body = [
      "You asked to hear about the latest Shama’s Kitchen menu updates.",
      "",
      "We will send new menu highlights, service updates, and larger-order notes here.",
      "",
      "Reply if you need pickup timing help or want to place a larger order.",
      "",
      "Chef Mo",
      "Shama’s Kitchen",
    ].join("\n");

    const mailto = new URL("mailto:");
    mailto.searchParams.set("bcc", activeUpdateEmails.join(","));
    mailto.searchParams.set("subject", "Shama’s Kitchen Menu Update");
    mailto.searchParams.set("body", body);
    window.location.href = mailto.toString();
  }

  function renderMenuForm(
    draft: MenuEditorState,
    onChange: <K extends keyof MenuEditorState>(key: K, value: MenuEditorState[K]) => void,
    actionLabel: string,
    onSubmit: () => void,
    disabled: boolean,
  ) {
    return (
      <div className="detail-panel">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "0.9rem",
          }}
        >
          <label className="detail-note">
            <strong>Name</strong>
            <input
              onChange={(event) => onChange("name", event.target.value)}
              style={inputStyle}
              value={draft.name}
            />
          </label>
          <label className="detail-note">
            <strong>Slug</strong>
            <input
              onChange={(event) => onChange("slug", event.target.value)}
              style={inputStyle}
              value={draft.slug}
            />
          </label>
          <label className="detail-note">
            <strong>Category</strong>
            <input
              onChange={(event) => onChange("category", event.target.value)}
              style={inputStyle}
              value={draft.category}
            />
          </label>
          <label className="detail-note">
            <strong>Price (cents)</strong>
            <input
              inputMode="numeric"
              onChange={(event) => onChange("priceCents", event.target.value)}
              style={inputStyle}
              value={draft.priceCents}
            />
          </label>
          <label className="detail-note">
            <strong>Availability</strong>
            <select
              onChange={(event) => onChange("availability", event.target.value as MenuItem["availability"])}
              style={inputStyle}
              value={draft.availability}
            >
              <option value="Live">Live</option>
              <option value="Watch">Watch</option>
              <option value="Paused">Paused</option>
              <option value="Sold Out">Sold Out</option>
            </select>
          </label>
          <label className="detail-note">
            <strong>Sort order</strong>
            <input
              inputMode="numeric"
              onChange={(event) => onChange("sortOrder", event.target.value)}
              style={inputStyle}
              value={draft.sortOrder}
            />
          </label>
          <label className="detail-note">
            <strong>Allocation limit</strong>
            <input
              inputMode="numeric"
              onChange={(event) => onChange("allocationLimit", event.target.value)}
              style={inputStyle}
              value={draft.allocationLimit}
            />
          </label>
          <label className="detail-note">
            <strong>Image URL</strong>
            <input
              onChange={(event) => onChange("imageUrl", event.target.value)}
              style={inputStyle}
              value={draft.imageUrl}
            />
          </label>
        </div>

        <label className="detail-note">
          <strong>Description</strong>
          <textarea
            onChange={(event) => onChange("description", event.target.value)}
            style={textareaStyle}
            value={draft.description}
          />
        </label>

        <label className="detail-note">
          <strong>Internal note</strong>
          <textarea
            onChange={(event) => onChange("notes", event.target.value)}
            style={textareaStyle}
            value={draft.notes}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            color: "rgba(255,255,255,0.82)",
            fontSize: "0.95rem",
          }}
        >
          <input
            checked={draft.isFeatured}
            onChange={(event) => onChange("isFeatured", event.target.checked)}
            type="checkbox"
          />
          <span>Feature this item in customer-facing ordering surfaces</span>
        </label>

        <div className="detail-actions">
          <button className="topbar-action" disabled={disabled} onClick={onSubmit} type="button">
            {disabled ? "Saving..." : actionLabel}
          </button>
        </div>
      </div>
    );
  }

  function renderOverview() {
    return (
      <section className="view-panel active">
        <OverviewKpiGrid kpis={snapshot.kpis}>
          <FulfillmentSummaryCards fulfillmentSummary={fulfillmentSummary} formatCurrency={formatCurrency} />
        </OverviewKpiGrid>

        <div className="overview-grid">
          <article className="card card-span-2">
            <div className="card-head">
              <div>
                <p className="card-kicker">Operations</p>
                <h2 className="card-title">Today at a glance</h2>
              </div>
              <div className="status-badge">
                {snapshot.operations.serviceDateLabel} · {snapshot.operations.status}
              </div>
            </div>
            <div className="pipeline-grid">
              {[
                { label: "Active Queue", count: snapshot.orders.filter((order) => order.status !== "Picked Up" && order.status !== "Cancelled").length, copy: snapshot.operations.queueSummary },
                { label: "Pickup Window", count: snapshot.orders.filter((order) => order.fulfillmentMethod === "pickup").length, copy: snapshot.operations.serviceWindow },
                { label: "Live Menu Items", count: snapshot.menu.filter((item) => item.availability === "Live").length, copy: "Items currently visible to customers." },
                { label: "Email Updates", count: emailUpdateSummary.activeCount, copy: "Active subscribers for menu and service updates." },
              ].map((stage) => (
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
                { title: "Open live orders", copy: "Review new tickets, notes, and ready orders.", target: "orders" as const },
                { title: "Review low stock", copy: "Jump into the ingredients most likely to pinch service.", target: "inventory" as const },
                { title: "Update live menu", copy: "Adjust price, copy, order, or availability without code.", target: "menu" as const },
                { title: "Review customers", copy: "See tracked buyers and email update signups.", target: "customers" as const },
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
                <p className="card-kicker">Featured Menu</p>
                <h2 className="card-title">What customers see first</h2>
              </div>
            </div>
            <div className="stack-list">
              {prepTargets.map((item) => (
                <div className="stack-item" key={item.id}>
                  <div className="stack-item-head">
                    <div className="stack-item-title">{item.name}</div>
                    <span className={`status-pill ${statusTone(item.availability)}`}>{item.availability}</span>
                  </div>
                  <div className="stack-item-copy">{item.description}</div>
                  <div className="stack-item-meta">
                    Sort {item.sortOrder} · {formatCurrency(item.priceCents)}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    );
  }

  function renderOrders() {
    return (
      <OrdersPanel
        filteredOrders={filteredOrders}
        fulfillmentFilter={fulfillmentFilter}
        fulfillmentFilters={fulfillmentFilters}
        formatCurrency={formatCurrency}
        onAdvanceStatus={handleAdvanceOrderStatus}
        onFulfillmentFilterChange={setFulfillmentFilter}
        onOpenCustomer={() => goTo("customers")}
        onOpenInventory={() => goTo("inventory")}
        onOrderFilterChange={setOrderFilter}
        onResetFilters={() => {
          setOrderFilter("all");
          setFulfillmentFilter("all");
        }}
        onSelectOrder={setSelectedOrderId}
        orderFilter={orderFilter}
        orderFilters={orderFilters}
        orders={snapshot.orders}
        selectedOrder={selectedOrder}
        selectedOrderId={selectedOrderId}
        statusError={statusError}
        statusTone={statusTone}
        statusUpdating={statusUpdatingOrderId === selectedOrder?.id}
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
                <h2 className="card-title">Coverage and prep risk</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>On Hand</th>
                    <th>Par</th>
                    <th>Status</th>
                    <th>Context</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.inventory.map((item) => (
                    <tr
                      className={item.id === selectedInventory?.id ? "is-selected" : ""}
                      key={item.id}
                      onClick={() => setSelectedInventoryId(item.id)}
                    >
                      <td>{item.name}</td>
                      <td>{item.onHand} {item.unit}</td>
                      <td>{item.parLevel} {item.unit}</td>
                      <td><span className={`status-pill ${statusTone(item.status)}`}>{item.status}</span></td>
                      <td>{item.notes ?? "No note recorded."}</td>
                    </tr>
                  ))}
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
                  <strong>Current impact</strong>
                  {getInventoryImpactCopy(selectedInventory)}
                </div>
                <div className="detail-list">
                  <div className="detail-list-item">
                    <span>Linked menu items</span>
                    <strong>
                      {selectedInventory.linkedMenuItems.length
                        ? selectedInventory.linkedMenuItems.map((item) => item.name).join(", ")
                        : "No linked menu items yet"}
                    </strong>
                  </div>
                  <div className="detail-list-item">
                    <span>Last updated</span>
                    <strong>{new Date(selectedInventory.lastUpdatedAt).toLocaleString()}</strong>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    );
  }

  function renderMenu() {
    const sortedMenu = [...snapshot.menu].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    return (
      <section className="view-panel active">
        <div className="content-grid">
          <article className="card card-span-2">
            <div className="card-head">
              <div>
                <p className="card-kicker">Menu Control</p>
                <h2 className="card-title">Live menu items</h2>
              </div>
              <div className="status-badge">{sortedMenu.length} items</div>
            </div>
            <div className="menu-control-grid">
              {sortedMenu.map((item) => (
                <article
                  className={`menu-card ${item.id === selectedMenuId ? "is-selected" : ""}`}
                  key={item.id}
                  onClick={() => setSelectedMenuId(item.id)}
                >
                  <div className="menu-card-meta">
                    <div>
                      <div className="menu-card-title">{item.name}</div>
                      <div className="stack-item-meta">
                        {item.category} · {formatCurrency(item.priceCents)} · sort {item.sortOrder}
                      </div>
                    </div>
                    <span className={`status-pill ${statusTone(item.availability)}`}>{item.availability}</span>
                  </div>
                  <div className="menu-card-copy">{item.description}</div>
                  <div className="menu-card-footer">
                    <span className="chip">{item.isFeatured ? "Featured" : "Standard"}</span>
                    <span className="stack-item-meta">{item.notes ?? "No internal note"}</span>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <aside className="detail-card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Selected Menu Item</p>
                <h2 className="card-title">{selectedMenu?.name ?? "Select a menu item"}</h2>
              </div>
            </div>
            {selectedMenu ? renderMenuForm(menuDraft, updateMenuDraft, "Save live menu item", () => saveMenuItem(selectedMenu.id), menuSaving) : null}
            {selectedMenu ? (
              <div className="detail-note">
                <strong>Ingredient dependencies</strong>
                {selectedMenuDependencies.length
                  ? selectedMenuDependencies.map((item) => item.name).join(", ")
                  : "No linked inventory items recorded yet."}
                {selectedMenuRiskItems.length ? ` ${selectedMenuRiskItems.length} linked ingredient(s) are currently flagged.` : ""}
              </div>
            ) : null}
            {menuError ? <div className="detail-note"><strong>Error</strong>{menuError}</div> : null}
            {menuMessage ? <div className="detail-note"><strong>Status</strong>{menuMessage}</div> : null}

            <div className="card-head" style={{ marginTop: "1.25rem" }}>
              <div>
                <p className="card-kicker">Create Item</p>
                <h2 className="card-title">Add a new live menu item</h2>
              </div>
            </div>
            {renderMenuForm(createDraft, updateCreateDraft, "Create menu item", createMenuItem, createSaving)}
          </aside>
        </div>
      </section>
    );
  }

  function renderCustomers() {
    return (
      <section className="view-panel active">
        <div className="analytics-grid">
          <div className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Customers</p>
                <h2 className="card-title">Tracked buyers and recent value</h2>
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
                  <div className="customer-card-copy">{customer.notes ?? "No customer note yet."}</div>
                  <div className="customer-card-footer">
                    <span className="chip">{formatCurrency(customer.lifetimeValueCents)} lifetime</span>
                  </div>
                </article>
              ))}
            </div>
            {selectedCustomer ? (
              <div className="detail-note" style={{ marginTop: "1rem" }}>
                <strong>Selected customer</strong>
                {selectedCustomer.email ?? "No email on file"} · last order {new Date(selectedCustomer.lastOrderAt).toLocaleString()}
              </div>
            ) : null}
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <p className="card-kicker">Email Updates</p>
                <h2 className="card-title">Customers waiting for the next menu message</h2>
              </div>
              <div className="status-badge">{emailUpdateSummary.activeCount} active</div>
            </div>
            <div className="customer-card-footer" style={{ marginTop: 0, marginBottom: 16 }}>
              <span className="chip">{emailUpdateSummary.recentCount} requested this week</span>
              <span className="chip">{snapshot.emailUpdates.length} total signups</span>
            </div>
            <div className="detail-actions" style={{ marginBottom: 16 }}>
              <button className="ghost-button" disabled={!activeUpdateEmails.length} onClick={handleCopyUpdateEmails} type="button">
                Copy active emails
              </button>
              <button className="ghost-button" disabled={!activeUpdateEmails.length} onClick={handleOpenUpdateDraft} type="button">
                Open outreach draft
              </button>
            </div>
            <div className="customer-grid">
              {emailUpdateSummary.updates.map((update) => (
                <article className="customer-card" key={update.id}>
                  <div className="customer-card-meta">
                    <div>
                      <div className="customer-card-title">{update.email}</div>
                      <div className="stack-item-meta">{formatReminderSource(update) || "Website signup"}</div>
                    </div>
                    <span className={`status-pill ${statusTone(update.status)}`}>{update.status}</span>
                  </div>
                  <div className="customer-card-copy">{update.notes ?? "No internal note recorded."}</div>
                  <div className="customer-card-footer">
                    <span className="chip">{new Date(update.lastRequestedAt).toLocaleString()}</span>
                    <a className="ghost-button" href={`mailto:${update.email}`} onClick={(event) => event.stopPropagation()}>
                      Email contact
                    </a>
                  </div>
                </article>
              ))}
            </div>
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
            <div className="bars-list">
              {analyticsBars.map((bar) => (
                <div className="bar-row" key={bar.label}>
                  <div className="bar-copy">
                    <strong>{bar.label}</strong>
                    <span>{bar.meta}</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.max((bar.value / maxValue) * 100, 8)}%` }} />
                  </div>
                  <span className="bar-value">{bar.value}%</span>
                </div>
              ))}
            </div>
          </article>

          <FulfillmentAnalyticsCards fulfillmentSummary={fulfillmentSummary} formatCurrency={formatCurrency} />
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
                <h2 className="card-title">Current surfaces</h2>
              </div>
            </div>
            <div className="stack-list">
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Website Concierge</div>
                  <span className="status-pill success">Live now</span>
                </div>
                <div className="stack-item-copy">Public site assistant for Shama’s Kitchen.</div>
              </div>
              <div className="stack-item">
                <div className="stack-item-head">
                  <div className="stack-item-title">Customer Mobile App</div>
                  <span className="status-pill warning">Phase 1 build</span>
                </div>
                <div className="stack-item-copy">Native ordering app using shared menu, auth, and checkout flows.</div>
              </div>
            </div>
          </article>
        </div>
      </section>
    );
  }

  const currentSection = sectionMeta[view];

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-kicker">Operator Console</div>
          <div className="brand-mark">
            <span className="brand-mo">SHAMA’S</span>
            <span className="brand-grillz">KITCHEN</span>
          </div>
          <div className="brand-sub">Ops Console</div>
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
            <div className="topbar-kicker">Shama’s Kitchen Ops</div>
            <h1 className="topbar-title">{currentSection.title}</h1>
            <p className="topbar-copy">{currentSection.copy}</p>
          </div>

          <div className="topbar-rail">
            <div className="topbar-pill">
              <span className="pill-label">Service Date</span>
              <strong>{snapshot.operations.serviceDateLabel}</strong>
            </div>
            <div className="topbar-pill topbar-pill-accent">
              <span className="pill-label">Status</span>
              <strong>{snapshot.operations.status}</strong>
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

const inputStyle = {
  width: "100%",
  marginTop: "0.75rem",
  padding: "0.85rem 1rem",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
} satisfies CSSProperties;

const textareaStyle = {
  width: "100%",
  minHeight: "120px",
  marginTop: "0.75rem",
  padding: "0.9rem 1rem",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
  resize: "vertical",
} satisfies CSSProperties;
