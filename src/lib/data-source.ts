import { cloneMockSnapshot, mockDashboardSnapshot } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Customer,
  DashboardSnapshot,
  Insight,
  InventoryItem,
  MenuItem,
  Order,
  OrderItem,
} from "@/types/domain";

type DataSourceKind = "mock" | "supabase";

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
  return {
    id: readString(row.order_number || row.id, crypto.randomUUID()),
    customerName: readString(row.customer_name, "Unknown Customer"),
    customerEmail: typeof row.customer_email === "string" ? row.customer_email : null,
    customerZone: readString(row.zone, "Northern Virginia"),
    status: capitalizeWords(readString(row.status), "New") as Order["status"],
    dropDay: capitalizeWords(readString(row.drop_day), "Wednesday") as Order["dropDay"],
    fulfillmentMethod,
    deliveryWindow: readString(
      row.delivery_window,
      fulfillmentMethod === "pickup"
        ? "Pickup details confirmed after checkout"
        : "Delivery timing confirmed after checkout",
    ),
    totalCents: readNumber(row.total_cents, 0),
    customRequest: typeof row.custom_request === "string" ? row.custom_request : null,
    paymentProvider: readString(row.payment_provider, "Stripe"),
    paymentStatus: readString(row.payment_status, "paid"),
    createdAt: readString(row.created_at, new Date().toISOString()),
    updatedAt: readString(row.updated_at, readString(row.created_at, new Date().toISOString())),
    items: nestedItems.map((item) => mapOrderItem(item as Row)),
  };
}

function mapInventoryItem(row: Row): InventoryItem {
  return {
    id: readString(row.id, crypto.randomUUID()),
    name: readString(row.name, "Unknown Inventory Item"),
    unit: readString(row.unit, "units"),
    onHand: readNumber(row.on_hand_qty, 0),
    parLevel: readNumber(row.par_level, 0),
    status: capitalizeWords(readString(row.status), "Watch") as InventoryItem["status"],
    lastUpdatedAt: readString(row.updated_at, new Date().toISOString()),
    notes: typeof row.notes === "string" ? row.notes : null,
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

async function tryRemoteSnapshot(): Promise<DashboardSnapshot | null> {
  const client = createSupabaseServerClient();

  if (!client) return null;

  try {
    const [ordersResponse, inventoryResponse, menuResponse, customersResponse, insightsResponse] =
      await Promise.all([
      client.from("orders").select("*, order_items(*)"),
      client.from("inventory_items").select("*"),
      client.from("menu_items").select("*"),
      client.from("customers").select("*"),
      client.from("insights").select("*"),
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

    return {
      generatedAt: new Date().toISOString(),
      drop: {
        day: "Wednesday",
        status: "Preorders Open",
        window: "6:15 PM - 8:30 PM",
        cutoff: "Tuesday 9:00 PM",
      },
      kpis: mockDashboardSnapshot.kpis,
      orders: (ordersResponse.data ?? []).map((row) => mapOrder(row as Row)),
      inventory: (inventoryResponse.data ?? []).map((row) => mapInventoryItem(row as Row)),
      menu: (menuResponse.data ?? []).map((row) => mapMenuItem(row as Row)),
      customers: (customersResponse.data ?? []).map((row) => mapCustomer(row as Row)),
      insights: (insightsResponse.data ?? []).map((row) => mapInsight(row as Row)),
    };
  } catch {
    return null;
  }
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (shouldUseMockData()) {
    return cloneMockSnapshot();
  }

  const remote = await tryRemoteSnapshot();
  return remote ?? cloneMockSnapshot();
}

export function getDataSourceKind(): DataSourceKind {
  return shouldUseMockData() ? "mock" : "supabase";
}

export function getMockDashboardSnapshot(): DashboardSnapshot {
  return cloneMockSnapshot();
}
