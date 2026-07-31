import "server-only";

import { getBusinessDate } from "@/lib/dashboard/metrics";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DashboardSnapshot } from "@/types/domain";

type MetricsPayload = {
  today_order_count?: unknown;
  recognized_revenue_cents?: unknown;
  low_stock_count?: unknown;
  inventory_count?: unknown;
  healthy_inventory_count?: unknown;
};

function readNonNegativeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatCompactCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export async function loadAuthoritativeDashboardKpis(): Promise<DashboardSnapshot["kpis"] | null> {
  const client = createSupabaseServerClient();
  if (!client) return null;

  const { data, error } = await client.rpc("get_ops_dashboard_metrics", {
    p_business_date: getBusinessDate(),
  });

  if (error) {
    console.error("[dashboard-metrics] aggregate RPC failed", {
      code: error.code,
      message: error.message,
    });
    return null;
  }

  const payload = (data ?? {}) as MetricsPayload;
  const todayOrderCount = readNonNegativeNumber(payload.today_order_count);
  const recognizedRevenueCents = readNonNegativeNumber(payload.recognized_revenue_cents);
  const lowStockCount = readNonNegativeNumber(payload.low_stock_count);
  const inventoryCount = readNonNegativeNumber(payload.inventory_count);
  const healthyInventoryCount = readNonNegativeNumber(payload.healthy_inventory_count);

  if (
    todayOrderCount === null ||
    recognizedRevenueCents === null ||
    lowStockCount === null ||
    inventoryCount === null ||
    healthyInventoryCount === null ||
    healthyInventoryCount > inventoryCount
  ) {
    console.error("[dashboard-metrics] aggregate RPC returned an invalid payload");
    return null;
  }

  const inventoryHealth = inventoryCount
    ? Math.round((healthyInventoryCount / inventoryCount) * 100)
    : null;

  return [
    {
      label: "Today's Service Orders",
      value: String(todayOrderCount),
      delta: "Non-cancelled orders scheduled for today",
      tone: "gold",
    },
    {
      label: "Paid Revenue To Date",
      value: formatCompactCurrency(recognizedRevenueCents),
      delta: "All paid orders; excludes unpaid and cancelled orders",
      tone: "green",
    },
    {
      label: "Low Stock Items",
      value: String(lowStockCount),
      delta: lowStockCount ? "Needs attention before prep" : "No low-stock flags",
      tone: lowStockCount ? "red" : "green",
    },
    {
      label: "Inventory Health",
      value: inventoryHealth === null ? "—" : `${inventoryHealth}%`,
      delta:
        inventoryHealth === null
          ? "No inventory rows loaded"
          : "Share of tracked items not marked low or out",
      tone: "blue",
    },
  ];
}
