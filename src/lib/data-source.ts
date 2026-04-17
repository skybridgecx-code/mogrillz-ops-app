import { cloneMockSnapshot } from "@/lib/mock-data";
import { normalizeOrderStatus } from "@/lib/dashboard/order-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Customer,
  DashboardSnapshot,
  EmailUpdate,
  Insight,
  InventoryItem,
  InventoryLinkedMenuItem,
  MenuItem,
  Order,
  OrderItem,
} from "@/types/domain";

export type DataSourceKind = "mock" | "supabase";

export interface DashboardDataState {
  snapshot: DashboardSnapshot | null;
  dataSource: DataSourceKind;
  dataIssue: string | null;
}

function shouldUseMockData() {
  const raw = process.env.NEXT_PUBLIC_USE_MOCK_DATA?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

function hasSupabaseDataConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  return Boolean(url && publishableKey);
}

type Row = Record<string, unknown>;

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function capitalizeWords(value: string, fallback: string) {
  if (!value) return fallback;
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeDeliveryWindow(value: unknown, fulfillmentMethod: Order["fulfillmentMethod"]) {
  const raw = readString(value).trim();
  const fallback =
    fulfillmentMethod === "pickup"
      ? "Pickup details confirmed after checkout"
      : "Pickup details confirmed after checkout";

  if (!raw) return fallback;

  const normalizedRaw = raw.toLowerCase();
  if (
    normalizedRaw === "pending route confirmation" ||
    normalizedRaw === "delivery timing confirmed after checkout" ||
    normalizedRaw === "delivery details confirmed after checkout"
  ) {
    return fallback;
  }

  if (fulfillmentMethod === "pickup") {
    return raw
      .replace(/\bdelivery\b/gi, "pickup")
      .replace(/\broute\b/gi, "pickup");
  }

  return raw;
}

function normalizeServiceDateValue(value: unknown) {
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const datePrefixMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
    if (datePrefixMatch?.[1]) return datePrefixMatch[1];

    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

function resolveServiceDate(row: Row) {
  const candidates = [
    row.service_date,
    row.serviceDate,
    row.pickup_date,
    row.pickupDate,
    row.fulfillment_date,
    row.fulfillmentDate,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeServiceDateValue(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function resolveServiceWindow(row: Row) {
  const candidates = [
    row.delivery_window,
    row.service_window,
    row.serviceWindow,
    row.pickup_window,
    row.pickupWindow,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const raw = candidate.trim();
    if (raw) return raw;
  }

  return "";
}

function mapOrderItem(row: Row): OrderItem {
  return {
    id: readString(row.id, crypto.randomUUID()),
    orderId: readString(row.order_id),
    menuItemId: typeof row.menu_item_id === "string" ? row.menu_item_id : null,
    name: readString(row.name, "Unknown Item"),
    quantity: readNumber(row.quantity, 1),
    notes: typeof row.notes === "string" ? row.notes : null,
    unitPriceCents: readNumber(row.unit_price_cents, 0),
  };
}

function mapOrder(row: Row): Order {
  const nestedItems = Array.isArray(row.order_items) ? row.order_items : [];
  const fulfillmentMethod = readString(row.fulfillment_method, "pickup").toLowerCase() === "delivery" ? "delivery" : "pickup";
  const id = readString(row.id, crypto.randomUUID());
  return {
    id,
    orderNumber: readString(row.order_number, id),
    customerName: readString(row.customer_name, "Unknown Customer"),
    customerEmail: typeof row.customer_email === "string" ? row.customer_email : null,
    customerZone: readString(row.zone, "Northern Virginia"),
    status: normalizeOrderStatus(row.status) ?? "New",
    serviceDate: resolveServiceDate(row),
    legacyDropDay: typeof row.drop_day === "string" ? capitalizeWords(readString(row.drop_day), "") : null,
    fulfillmentMethod,
    serviceWindow: normalizeDeliveryWindow(resolveServiceWindow(row), fulfillmentMethod),
    totalCents: readNumber(row.total_cents, 0),
    customRequest: typeof row.custom_request === "string" ? row.custom_request : null,
    operatorNote: typeof row.operator_note === "string" ? row.operator_note : null,
    paymentProvider: readString(row.payment_provider, "Stripe"),
    paymentStatus: readString(row.payment_status, "paid"),
    createdAt: readString(row.created_at, new Date().toISOString()),
    updatedAt: readString(row.updated_at, readString(row.created_at, new Date().toISOString())),
    items: nestedItems.map((item) => mapOrderItem(item as Row)),
  };
}

function mapInventoryItem(row: Row, linkedMenuItems: InventoryLinkedMenuItem[] = []): InventoryItem {
  return {
    id: readString(row.id, crypto.randomUUID()),
    name: readString(row.name, "Unknown Inventory Item"),
    unit: readString(row.unit, "units"),
    onHand: readNumber(row.on_hand_qty, 0),
    parLevel: readNumber(row.par_level, 0),
    status: capitalizeWords(readString(row.status), "Watch") as InventoryItem["status"],
    lastUpdatedAt: readString(row.updated_at, new Date().toISOString()),
    notes: typeof row.notes === "string" ? row.notes : null,
    linkedMenuItems,
  };
}

function mapMenuItem(row: Row): MenuItem {
  const slug = readString(row.slug, readString(row.id, crypto.randomUUID()));
  return {
    id: readString(row.id, slug),
    slug,
    name: readString(row.name, "Unknown Menu Item"),
    category: readString(row.category, "Menu"),
    priceCents: readNumber(row.price_cents, 0),
    availability: capitalizeWords(readString(row.availability), "Live") as MenuItem["availability"],
    allocationLimit: readNumber(row.allocation_limit, 0),
    description: readString(row.description, ""),
    imageUrl: typeof row.image_url === "string" ? row.image_url : null,
    sortOrder: readNumber(row.sort_order, 0),
    isFeatured: Boolean(row.is_featured),
    notes: typeof row.notes === "string" ? row.notes : null,
  };
}

function mapCustomer(row: Row): Customer {
  const loyalty = capitalizeWords(readString(row.loyalty_tier), "Early");
  return {
    id: readString(row.id, crypto.randomUUID()),
    name: readString(row.name, "Unknown Customer"),
    email: typeof row.email === "string" ? row.email : null,
    zone: readString(row.zone, "Northern Virginia"),
    totalOrders: readNumber(row.total_orders, 0),
    lifetimeValueCents: readNumber(row.lifetime_value_cents, 0),
    loyaltyTier: (loyalty === "New" ? "Early" : loyalty) as Customer["loyaltyTier"],
    notes: typeof row.notes === "string" ? row.notes : null,
    lastOrderAt: readString(row.updated_at, new Date().toISOString()),
  };
}

function mapEmailUpdate(row: Row): EmailUpdate {
  return {
    id: readString(row.id, crypto.randomUUID()),
    email: readString(row.email),
    source: readString(row.source, "website"),
    signupLocation: typeof row.signup_location === "string" ? row.signup_location : null,
    status: capitalizeWords(readString(row.status), "Active") as EmailUpdate["status"],
    notes: typeof row.notes === "string" ? row.notes : null,
    lastRequestedAt: readString(row.last_requested_at, new Date().toISOString()),
    createdAt: readString(row.created_at, new Date().toISOString()),
    updatedAt: readString(row.updated_at, readString(row.created_at, new Date().toISOString())),
  };
}

function mapInsight(row: Row): Insight {
  const rawType = readString(row.type, "ops").toLowerCase();
  const typeMap: Record<string, Insight["type"]> = {
    prep: "prep",
    prep_recommendation: "prep",
    demand: "demand",
    demand_signal: "demand",
    ops: "ops",
    operational_risk: "ops",
    content: "content",
    content_angle: "content",
  };
  const type = typeMap[rawType] ?? "ops";
  const toneByType: Record<Insight["type"], Insight["tone"]> = {
    prep: "success",
    demand: "warning",
    ops: "danger",
    content: "info",
  };

  return {
    id: readString(row.id, crypto.randomUUID()),
    type,
    title: readString(row.title, "Untitled Insight"),
    summary: readString(row.summary, ""),
    confidence: readNumber(row.confidence, 0),
    actionText: readString(row.action_text, "No action recorded."),
    tone: toneByType[type] ?? "info",
    createdAt: readString(row.created_at, new Date().toISOString()),
  };
}

function formatCompactCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatServiceDateLabel(serviceDate: string | null) {
  if (!serviceDate) return "Upcoming";

  const parsed = new Date(`${serviceDate}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) return "Upcoming";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function deriveOperationsSnapshot(orders: Order[]): DashboardSnapshot["operations"] {
  if (!orders.length) {
    return {
      serviceDateLabel: "Upcoming",
      status: "No live orders",
      queueSummary: "Awaiting synced orders",
      serviceWindow: "Pickup details confirmed after checkout",
    };
  }

  const ordersByDate = new Map<string, Order[]>();
  for (const order of orders) {
    const key = order.serviceDate || order.legacyDropDay || "unscheduled";
    const existing = ordersByDate.get(key) ?? [];
    existing.push(order);
    ordersByDate.set(key, existing);
  }

  let activeKey = orders[0].serviceDate || orders[0].legacyDropDay || "unscheduled";
  let activeOrders = ordersByDate.get(activeKey) ?? [orders[0]];

  for (const [key, dateOrders] of ordersByDate.entries()) {
    if (dateOrders.length > activeOrders.length) {
      activeKey = key;
      activeOrders = dateOrders;
    }
  }

  const activeStatuses = new Set(activeOrders.map((order) => order.status));
  const status =
    activeStatuses.has("In Prep") || activeStatuses.has("Ready") || activeStatuses.has("New")
      ? "Orders Active"
      : "Service Wrapped";

  const windows = [...new Set(activeOrders.map((order) => order.serviceWindow).filter(Boolean))];
  const serviceWindow =
    windows.length === 0
      ? "Window pending"
      : windows.length === 1
        ? windows[0]
        : `${windows.length} live fulfillment windows`;

  return {
    serviceDateLabel:
      activeKey === "unscheduled"
        ? "Upcoming"
        : activeOrders[0]?.serviceDate
          ? formatServiceDateLabel(activeOrders[0].serviceDate)
          : activeKey,
    status,
    queueSummary: `${activeOrders.length} synced orders`,
    serviceWindow,
  };
}

function deriveKpis(orders: Order[], inventory: InventoryItem[]): DashboardSnapshot["kpis"] {
  const pickupCount = orders.filter((order) => order.fulfillmentMethod === "pickup").length;
  const totalRevenueCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const lowStockCount = inventory.filter((item) => item.status === "Low" || item.status === "Out").length;
  const healthyInventoryCount = inventory.filter((item) => item.status !== "Low" && item.status !== "Out").length;
  const prepConfidence = inventory.length
    ? Math.round((healthyInventoryCount / inventory.length) * 100)
    : 100;

  return [
    {
      label: "Today's Orders",
      value: String(orders.length),
      delta: `${pickupCount} next-day pickup`,
      tone: "gold",
    },
    {
      label: "Revenue To Date",
      value: formatCompactCurrency(totalRevenueCents),
      delta: `${orders.length} paid synced orders`,
      tone: "green",
    },
    {
      label: "Low Stock Items",
      value: String(lowStockCount),
      delta: lowStockCount ? "Needs attention before prep" : "All stocked for service",
      tone: lowStockCount ? "red" : "green",
    },
    {
      label: "Prep Confidence",
      value: `${prepConfidence}%`,
      delta: "Based on current inventory health",
      tone: "blue",
    },
  ];
}

async function tryRemoteSnapshot(): Promise<DashboardSnapshot | null> {
  const client = createSupabaseServerClient();

  if (!client) return null;

  try {
    const [
      ordersResponse,
      inventoryResponse,
      menuResponse,
      customersResponse,
      insightsResponse,
      inventoryLinksResponse,
      dropRemindersResponse,
    ] =
      await Promise.all([
        client.from("orders").select("*, order_items(*)"),
        client.from("inventory_items").select("*"),
        client.from("menu_items").select("*"),
        client.from("customers").select("*"),
        client.from("insights").select("*"),
        client.from("inventory_item_menu_links").select("inventory_item_id,menu_item_id"),
        client.from("drop_reminders").select("*"),
      ]);

    if (
      ordersResponse.error ||
      inventoryResponse.error ||
      menuResponse.error ||
      customersResponse.error ||
      insightsResponse.error
    ) {
      return null;
    }

    const orders = (ordersResponse.data ?? []).map((row) => mapOrder(row as Row));
    const menuRows = (menuResponse.data ?? []) as Row[];
    const menu = menuRows.map((row) => mapMenuItem(row));
    const menuByDatabaseId = new Map(
      menuRows.map((row) => {
        const databaseId = readString(row.id);
        return [
          databaseId,
          {
            id: databaseId || crypto.randomUUID(),
            name: readString(row.name, "Unknown Menu Item"),
          },
        ];
      }),
    );
    const linkedMenuItemsByInventoryId = new Map<string, InventoryLinkedMenuItem[]>();

    if (!inventoryLinksResponse.error) {
      for (const row of inventoryLinksResponse.data ?? []) {
        const inventoryItemId = typeof row.inventory_item_id === "string" ? row.inventory_item_id : "";
        const menuItemId = typeof row.menu_item_id === "string" ? row.menu_item_id : "";
        if (!inventoryItemId || !menuItemId) continue;

        const menuItem = menuByDatabaseId.get(menuItemId);
        if (!menuItem) continue;

        const existing = linkedMenuItemsByInventoryId.get(inventoryItemId) ?? [];
        existing.push({ id: menuItem.id, name: menuItem.name });
        linkedMenuItemsByInventoryId.set(inventoryItemId, existing);
      }
    }

    const inventory = (inventoryResponse.data ?? []).map((row) =>
      mapInventoryItem(
        row as Row,
        linkedMenuItemsByInventoryId.get(readString((row as Row).id)) ?? [],
      ),
    );
    const customers = (customersResponse.data ?? []).map((row) => mapCustomer(row as Row));
    const emailUpdates = dropRemindersResponse.error
      ? []
      : (dropRemindersResponse.data ?? []).map((row) => mapEmailUpdate(row as Row));
    const insights = (insightsResponse.data ?? []).map((row) => mapInsight(row as Row));

    return {
      generatedAt: new Date().toISOString(),
      operations: deriveOperationsSnapshot(orders),
      kpis: deriveKpis(orders, inventory),
      orders,
      inventory,
      menu,
      customers,
      emailUpdates,
      insights,
    };
  } catch {
    return null;
  }
}

export async function loadDashboardDataState(): Promise<DashboardDataState> {
  if (shouldUseMockData()) {
    return {
      snapshot: cloneMockSnapshot(),
      dataSource: "mock",
      dataIssue: null,
    };
  }

  if (!hasSupabaseDataConfig()) {
    return {
      snapshot: null,
      dataSource: "supabase",
      dataIssue:
        "Supabase config is missing, and mock mode is not explicitly enabled. The dashboard is intentionally blocked to avoid showing fake ops data.",
    };
  }

  const remote = await tryRemoteSnapshot();
  if (remote) {
    return {
      snapshot: remote,
      dataSource: "supabase",
      dataIssue: null,
    };
  }

  return {
    snapshot: null,
    dataSource: "supabase",
    dataIssue:
      "Supabase data could not be loaded. The dashboard is intentionally hiding fallback demo data until the connection is healthy again.",
  };
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const result = await loadDashboardDataState();

  if (result.snapshot) {
    return result.snapshot;
  }

  throw new Error(result.dataIssue ?? "Dashboard data unavailable.");
}

export function getDataSourceKind(): DataSourceKind {
  return shouldUseMockData() ? "mock" : "supabase";
}

export function getMockDashboardSnapshot(): DashboardSnapshot {
  return cloneMockSnapshot();
}
