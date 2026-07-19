"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AnalyticsView } from "@/components/dashboard/views/analytics-view";
import { CustomersView } from "@/components/dashboard/views/customers-view";
import { InventoryView } from "@/components/dashboard/views/inventory-view";
import { MenuView } from "@/components/dashboard/views/menu-view";
import { OrdersView } from "@/components/dashboard/views/orders-view";
import { TodayView } from "@/components/dashboard/views/today-view";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { isActiveOrder, timeAgo } from "@/lib/dashboard/format";
import type { DashboardSnapshot, MenuItem, Order } from "@/types/domain";

type DataSourceKind = "mock" | "supabase";

export type ViewKey = "today" | "orders" | "inventory" | "menu" | "customers" | "analytics";

export interface MenuPayload {
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  availability: MenuItem["availability"];
  allocationLimit: number;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isFeatured: boolean;
  notes: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface OpsApi {
  advanceOrder: (orderId: string, nextStatus: Order["status"]) => Promise<boolean>;
  saveOrderNote: (orderId: string, note: string) => Promise<boolean>;
  saveInventory: (id: string, input: { onHand: number; parLevel: number; notes: string | null }) => Promise<boolean>;
  saveMenuItem: (id: string, payload: MenuPayload) => Promise<boolean>;
  createMenuItem: (payload: MenuPayload) => Promise<string | null>;
}

const NAV: Array<{ key: ViewKey; label: string; short: string; icon: string; sub: string }> = [
  { key: "today", label: "Today", short: "Today", icon: "🔥", sub: "What needs you right now — orders in motion, stock pressure, and the day's pulse." },
  { key: "orders", label: "Orders", short: "Orders", icon: "🧾", sub: "Move tickets from new to picked up. Tap a card for the full order." },
  { key: "inventory", label: "Inventory", short: "Stock", icon: "📦", sub: "Stock levels against par. Tap an ingredient to adjust counts in seconds." },
  { key: "menu", label: "Menu", short: "Menu", icon: "🍽️", sub: "What customers see on the live site. Edit, pause, or add dishes — no code." },
  { key: "customers", label: "Customers", short: "People", icon: "👥", sub: "Your regulars, VIPs, and everyone waiting on the next menu update." },
  { key: "analytics", label: "Analytics", short: "Trends", icon: "📈", sub: "What's selling, who's coming back, and how fast orders move." },
];

const VIEW_TITLES: Record<ViewKey, string> = {
  today: "Today",
  orders: "Order Board",
  inventory: "Inventory",
  menu: "Menu Studio",
  customers: "Customers",
  analytics: "Analytics",
};

const EMPTY_SNAPSHOT: DashboardSnapshot = {
  generatedAt: new Date(0).toISOString(),
  operations: {
    serviceDateLabel: "Upcoming",
    status: "Unavailable",
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

function DashboardInner({
  snapshot: initialSnapshot,
  dataSource,
  dataIssue,
}: {
  snapshot: DashboardSnapshot | null;
  dataSource: DataSourceKind;
  dataIssue?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const snapshot = initialSnapshot ?? EMPTY_SNAPSHOT;

  const [view, setView] = useState<ViewKey>("today");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const syncHash = () => {
      const raw = window.location.hash.replace("#", "") as ViewKey;
      if (raw && NAV.some((item) => item.key === raw)) setView(raw);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (dataSource !== "supabase") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60000);
    return () => clearInterval(id);
  }, [dataSource, router]);

  const goTo = useCallback((next: ViewKey) => {
    setView(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${next}`);
      window.scrollTo({ top: 0 });
    }
  }, []);

  /* -------- Mutations -------- */

  const patchJson = useCallback(
    async (url: string, method: string, body: unknown, successMessage: string) => {
      try {
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = (await response.json().catch(() => null)) as { error?: string; id?: string } | null;
        if (!response.ok) throw new Error(payload?.error || "Something went wrong.");
        toast(successMessage, "success");
        router.refresh();
        return payload;
      } catch (error) {
        toast(error instanceof Error ? error.message : "Something went wrong.", "error");
        return null;
      }
    },
    [router, toast],
  );

  const api = useMemo<OpsApi>(
    () => ({
      advanceOrder: async (orderId, nextStatus) => {
        const label = nextStatus === "Cancelled" ? "Order cancelled" : `Order moved to ${nextStatus}`;
        return Boolean(await patchJson(`/api/orders/${orderId}/status`, "PATCH", { status: nextStatus }, label));
      },
      saveOrderNote: async (orderId, note) =>
        Boolean(await patchJson(`/api/orders/${orderId}/note`, "PATCH", { operatorNote: note || null }, "Note saved")),
      saveInventory: async (id, input) =>
        Boolean(await patchJson(`/api/inventory/${id}`, "PATCH", input, "Stock updated")),
      saveMenuItem: async (id, payload) =>
        Boolean(await patchJson(`/api/menu/${id}`, "PATCH", payload, "Menu item saved — live on your site")),
      createMenuItem: async (payload) => {
        const result = await patchJson("/api/menu", "POST", payload, "New dish added to the live menu");
        return result?.id ?? null;
      },
    }),
    [patchJson],
  );

  /* -------- Derived -------- */

  const activeOrders = useMemo(() => snapshot.orders.filter(isActiveOrder), [snapshot.orders]);
  const lowStock = useMemo(
    () => snapshot.inventory.filter((item) => item.status === "Low" || item.status === "Out"),
    [snapshot.inventory],
  );

  const badges: Partial<Record<ViewKey, { count: number; tone: "warning" | "danger" }>> = {};
  if (activeOrders.length) badges.orders = { count: activeOrders.length, tone: "warning" };
  if (lowStock.length) badges.inventory = { count: lowStock.length, tone: "danger" };

  const syncedLabel = dataSource === "mock" ? "Demo data" : `Live · ${timeAgo(snapshot.generatedAt, now)}`;
  const activeNav = NAV.find((item) => item.key === view) ?? NAV[0];

  /* -------- Render -------- */

  if (dataIssue && !initialSnapshot) {
    return (
      <div className="app">
        <main className="main" style={{ gridColumn: "1 / -1", maxWidth: 560, margin: "8vh auto" }}>
          <div className="card">
            <p className="kicker">Connection issue</p>
            <h1 className="card-title" style={{ fontSize: "1.3rem" }}>Live data is unavailable</h1>
            <p className="muted" style={{ margin: "0.6rem 0 1rem" }}>{dataIssue}</p>
            <button className="btn btn-primary" onClick={() => router.refresh()} type="button">
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-flame">🔥</div>
          <div className="brand-name">
            SHAMA&rsquo;S <em>KITCHEN</em>
          </div>
          <div className="brand-sub">Ops Console</div>
        </div>

        <nav aria-label="Sections" className="nav">
          {NAV.map((item) => {
            const badge = badges[item.key];
            return (
              <button
                className={`nav-item ${view === item.key ? "active" : ""}`}
                key={item.key}
                onClick={() => goTo(item.key)}
                type="button"
              >
                <span aria-hidden className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {badge ? <span className={`nav-dot ${badge.tone}`}>{badge.count}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="live-row">
            <span className={`live-dot ${dataSource === "mock" ? "muted" : ""}`} />
            {syncedLabel}
          </div>
          <a href="https://mogrillzva.vercel.app" rel="noreferrer" target="_blank">
            View public site ↗
          </a>
          <a href="https://mogrillzva.vercel.app/social-agent.html" rel="noreferrer" target="_blank">
            Social agent ↗
          </a>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1 className="topbar-title">{VIEW_TITLES[view]}</h1>
            <p className="topbar-sub">{activeNav.sub}</p>
          </div>
          <div className="topbar-side">
            <span className={`pill ${dataSource === "mock" ? "" : "success"}`}>{syncedLabel}</span>
            <span className="pill warning">{snapshot.operations.serviceDateLabel}</span>
          </div>
        </header>

        <div className="view" key={view}>
          {view === "today" && (
            <TodayView api={api} goTo={goTo} lowStock={lowStock} now={now} snapshot={snapshot} />
          )}
          {view === "orders" && <OrdersView api={api} now={now} orders={snapshot.orders} />}
          {view === "inventory" && <InventoryView api={api} inventory={snapshot.inventory} />}
          {view === "menu" && <MenuView api={api} inventory={snapshot.inventory} menu={snapshot.menu} />}
          {view === "customers" && (
            <CustomersView customers={snapshot.customers} emailUpdates={snapshot.emailUpdates} />
          )}
          {view === "analytics" && <AnalyticsView customers={snapshot.customers} orders={snapshot.orders} />}
        </div>
      </main>

      <nav aria-label="Sections" className="bottomnav">
        {NAV.map((item) => {
          const badge = badges[item.key];
          return (
            <button
              className={`bnav-item ${view === item.key ? "active" : ""}`}
              key={item.key}
              onClick={() => goTo(item.key)}
              type="button"
            >
              <span aria-hidden className="bnav-icon">{item.icon}</span>
              {item.short}
              {badge ? <span className="bnav-badge">{badge.count}</span> : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function DashboardApp(props: {
  snapshot: DashboardSnapshot | null;
  dataSource: DataSourceKind;
  dataIssue?: string | null;
}) {
  return (
    <ToastProvider>
      <DashboardInner {...props} />
    </ToastProvider>
  );
}
