import { cloneMockSnapshot } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Customer,
  DashboardSnapshot,
  DropReminder,
  DropDay,
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
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
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
      : "Delivery timing confirmed after checkout";

  if (!raw) return fallback;
  if (raw.toLowerCase() === "pending route confirmation") {
    return fallback;
  }

  return raw;
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
  const fulfillmentMethod = readString(row.fulfillment_method, "delivery").toLowerCase() === "pickup" ? "pickup" : "delivery";
  const id = readString(row.id, crypto.randomUUID());
  return {
    id,
    orderNumber: readString(row.order_number, id),
    customerName: readString(row.customer_name, "Unknown Customer"),
    customerEmail: typeof row.customer_email === "string" ? row.customer_email : null,
    customerZone: readString(row.zone, "Northern Virginia"),
    status: capitalizeWords(readString(row.status), "New") as Order["status"],
    dropDay: capitalizeWords(readString(row.drop_day), "Wednesday") as Order["dropDay"],
    fulfillmentMethod,
    deliveryWindow: normalizeDeliveryWindow(row.delivery_window, fulfillmentMethod),
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
  return {
    id: readString(row.slug || row.id, crypto.randomUUID()),
    name: readString(row.name, "Unknown Menu Item"),
    category: readString(row.category, "Menu"),
    priceCents: readNumber(row.price_cents, 0),
    availability: capitalizeWords(readString(row.availability), "Live") as MenuItem["availability"],
    allocationLimit: readNumber(row.allocation_limit, 0),
    description: readString(row.description, ""),
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

function mapDropReminder(row: Row): DropReminder {
  return {
    id: readString(row.id, crypto.randomUUID()),
    email: readString(row.email),
    source: readString(row.source, "website"),
    signupLocation: typeof row.signup_location === "string" ? row.signup_location : null,
    status: capitalizeWords(readString(row.status), "Active") as DropReminder["status"],
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

function getCurrentScheduledDropDay(now = new Date()): DropDay {
  const weekday = now.getDay();
  if (weekday <= 1) return "Monday";
  if (weekday <= 3) return "Wednesday";
  if (weekday <= 5) return "Friday";
  return "Monday";
}

function deriveDropSnapshot(orders: Order[]): DashboardSnapshot["drop"] {
  if (!orders.length) {
    return {
      day: getCurrentScheduledDropDay(),
      status: "No live orders",
      window: "Awaiting synced orders",
      cutoff: "Check public site schedule",
    };
  }

  const ordersByDay = new Map<DropDay, Order[]>();
  for (const order of orders) {
    const existing = ordersByDay.get(order.dropDay) ?? [];
    existing.push(order);
    ordersByDay.set(order.dropDay, existing);
  }

  let activeDay: DropDay = orders[0].dropDay;
  let activeOrders = ordersByDay.get(activeDay) ?? [orders[0]];

  for (const [day, dayOrders] of ordersByDay.entries()) {
    if (dayOrders.length > activeOrders.length) {
      activeDay = day;
      activeOrders = dayOrders;
    }
  }

  const activeStatuses = new Set(activeOrders.map((order) => order.status));
  const status =
    activeStatuses.has("In Prep") || activeStatuses.has("Ready") || activeStatuses.has("New")
      ? "Orders Active"
      : "Service Wrapped";

  const windows = [...new Set(activeOrders.map((order) => order.deliveryWindow).filter(Boolean))];
  const window =
    windows.length === 0
      ? "Window pending"
      : windows.length === 1
        ? windows[0]
        : `${windows.length} live fulfillment windows`;

  return {
    day: activeDay,
    status,
    window,
    cutoff: `${activeOrders.length} synced orders`,
  };
}

function deriveKpis(orders: Order[], inventory: InventoryItem[]): DashboardSnapshot["kpis"] {
  const deliveryCount = orders.filter((order) => order.fulfillmentMethod === "delivery").length;
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
      delta: `${deliveryCount} delivery · ${pickupCount} pickup`,
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
            id: readString(row.slug || row.id, databaseId || crypto.randomUUID()),
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
    const dropReminders = dropRemindersResponse.error
      ? []
      : (dropRemindersResponse.data ?? []).map((row) => mapDropReminder(row as Row));
    const insights = (insightsResponse.data ?? []).map((row) => mapInsight(row as Row));

    return {
      generatedAt: new Date().toISOString(),
      drop: deriveDropSnapshot(orders),
      kpis: deriveKpis(orders, inventory),
      orders,
      inventory,
      menu,
      customers,
      dropReminders,
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
