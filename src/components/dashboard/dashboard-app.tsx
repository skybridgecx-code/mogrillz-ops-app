"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { FrontierNavIcon } from "@/components/dashboard/frontier-nav-icon";
import { AnalyticsView } from "@/components/dashboard/views/analytics-view";
import { CustomersView } from "@/components/dashboard/views/customers-view";
import { InventoryView } from "@/components/dashboard/views/inventory-view";
import { MenuView } from "@/components/dashboard/views/menu-view";
import { OrdersView } from "@/components/dashboard/views/orders-view";
import { TodayView } from "@/components/dashboard/views/today-view";
import { Panel } from "@/components/foundation/Panel";
import { SectionHeader } from "@/components/foundation/SectionHeader";
import { StatusBadge } from "@/components/foundation/StatusBadge";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/dashboard/format";
import {
  DASHBOARD_NAV,
  VIEW_TITLES,
  isViewKey,
  type ViewKey,
} from "@/lib/dashboard/navigation";
import { createDashboardReadModels } from "@/lib/dashboard/read-models";
import type { DashboardSnapshot, MenuItem, Order } from "@/types/domain";

type DataSourceKind = "mock" | "supabase";

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
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

export interface OpsApi {
  advanceOrder: (orderId: string, nextStatus: Order["status"]) => Promise<boolean>;
  saveOrderNote: (orderId: string, note: string) => Promise<boolean>;
  saveInventory: (id: string, input: { onHand: number; parLevel: number; notes: string | null }) => Promise<boolean>;
  saveMenuItem: (id: string, payload: MenuPayload) => Promise<boolean>;
  createMenuItem: (payload: MenuPayload) => Promise<string | null>;
}

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
  const readModels = useMemo(() => createDashboardReadModels(snapshot), [snapshot]);

  const [view, setView] = useState<ViewKey>("today");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const syncHash = () => {
      const raw = window.location.hash.replace("#", "");
      if (isViewKey(raw)) setView(raw);
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
        Boolean(await patchJson(`/api/menu/${id}`, "PATCH", payload, "Menu item saved")),
      createMenuItem: async (payload) => {
        const result = await patchJson("/api/menu", "POST", payload, "Menu item created");
        return result?.id ?? null;
      },
    }),
    [patchJson],
  );

  const badges: Partial<Record<ViewKey, { count: number; tone: "warning" | "danger" }>> = {};
  if (readModels.today.activeOrders.length) {
    badges.orders = { count: readModels.today.activeOrders.length, tone: "warning" };
  }
  if (readModels.today.lowStock.length) {
    badges.inventory = { count: readModels.today.lowStock.length, tone: "danger" };
  }

  const syncedLabel = dataSource === "mock" ? "Demo data" : `Live · ${timeAgo(snapshot.generatedAt, now)}`;
  const activeNav = DASHBOARD_NAV.find((item) => item.key === view) ?? DASHBOARD_NAV[0];

  if (dataIssue && !initialSnapshot) {
    return (
      <div className="app-shell frontier-connection">
        <Panel className="frontier-connection__panel">
          <SectionHeader
            description={dataIssue}
            eyebrow="Connection issue"
            headingLevel="h1"
            title="Live operations data is unavailable"
          />
          <button className="frontier-primary-button" onClick={() => router.refresh()} style={{ marginTop: "1.5rem" }} type="button">
            Retry connection
          </button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="app-shell frontier-shell">
      <aside className="frontier-sidebar">
        <div className="frontier-brand">
          <div aria-hidden="true" className="frontier-brand__mark">SK</div>
          <div className="frontier-brand__copy">
            <p className="frontier-brand__name">Shama&rsquo;s Kitchen</p>
            <p className="frontier-brand__product">Frontier Ops</p>
          </div>
        </div>

        <nav aria-label="Operations sections" className="frontier-nav">
          {DASHBOARD_NAV.map((item) => {
            const badge = badges[item.key];
            const isActive = view === item.key;
            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className="frontier-nav__item"
                key={item.key}
                onClick={() => goTo(item.key)}
                title={item.label}
                type="button"
              >
                <span className="frontier-nav__icon"><FrontierNavIcon view={item.key} /></span>
                <span className="frontier-nav__label">{item.label}</span>
                {badge ? (
                  <span className="frontier-nav__badge" data-tone={badge.tone}>{badge.count}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="frontier-sidebar__footer">
          <div className="frontier-sync">
            <span className="frontier-sync__dot" data-source={dataSource} />
            <span>{syncedLabel}</span>
          </div>
          <div className="frontier-sidebar__links">
            <a href="https://mogrillzva.vercel.app" rel="noreferrer" target="_blank">Open public site</a>
            <a href="https://mogrillzva.vercel.app/social-agent.html" rel="noreferrer" target="_blank">Open social agent</a>
          </div>
        </div>
      </aside>

      <main className="frontier-main">
        <header className="frontier-topbar">
          <div>
            <p className="frontier-topbar__eyebrow">Frontier Ops</p>
            <h1 className="frontier-topbar__title">{VIEW_TITLES[view]}</h1>
            <p className="frontier-topbar__description">{activeNav.description}</p>
          </div>
          <div className="frontier-topbar__status">
            <StatusBadge status={dataSource === "mock" ? "neutral" : "ready"}>{syncedLabel}</StatusBadge>
            <StatusBadge status="review">{readModels.today.operations.serviceDateLabel}</StatusBadge>
          </div>
        </header>

        <div className="frontier-content">
          <div className={`frontier-view frontier-view--${view}`} key={view}>
            {view === "today" && <TodayView api={api} goTo={goTo} model={readModels.today} now={now} />}
            {view === "orders" && <OrdersView api={api} now={now} orders={readModels.orders.orders} />}
            {view === "inventory" && <InventoryView api={api} inventory={readModels.inventory.inventory} />}
            {view === "menu" && (
              <MenuView api={api} inventory={readModels.menu.inventory} menu={readModels.menu.menu} />
            )}
            {view === "customers" && (
              <CustomersView
                customers={readModels.customers.customers}
                emailUpdates={readModels.customers.emailUpdates}
              />
            )}
            {view === "analytics" && (
              <AnalyticsView
                customers={readModels.analytics.customers}
                orders={readModels.analytics.orders}
              />
            )}
          </div>
        </div>
      </main>

      <nav aria-label="Operations sections" className="frontier-bottom-nav">
        {DASHBOARD_NAV.map((item) => {
          const badge = badges[item.key];
          const isActive = view === item.key;
          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className="frontier-bottom-nav__item"
              key={item.key}
              onClick={() => goTo(item.key)}
              type="button"
            >
              <FrontierNavIcon height={18} view={item.key} width={18} />
              <span>{item.short}</span>
              {badge ? <span className="frontier-bottom-nav__badge">{badge.count}</span> : null}
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
