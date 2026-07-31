import { normalizeOrderStatus } from "@/lib/dashboard/order-status";
import {
  getBusinessDate,
  getInventoryHealthPercent,
  getOrdersForBusinessDate,
  getRecognizedRevenueCents,
} from "@/lib/dashboard/metrics";
import { cloneMockSnapshot } from "@/lib/mock-data";
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

const DEFAULT_IMAGE_BUCKET = process.env.MOGRILLZ_MENU_IMAGE_BUCKET?.trim() || "food pics";
const ORDER_HISTORY_LIMIT = readBoundedIntegerEnv("MOGRILLZ_OPS_ORDER_HISTORY_LIMIT", 500, 50, 2000);
const CUSTOMER_LIMIT = readBoundedIntegerEnv("MOGRILLZ_OPS_CUSTOMER_LIMIT", 1000, 50, 5000);
const SUBSCRIBER_LIMIT = readBoundedIntegerEnv("MOGRILLZ_OPS_SUBSCRIBER_LIMIT", 1000, 50, 5000);
const INSIGHT_LIMIT = readBoundedIntegerEnv("MOGRILLZ_OPS_INSIGHT_LIMIT", 50, 1, 250);

const ORDER_SELECT = "id,order_number,customer_id,customer_name,customer_email,status,drop_day,service_date,fulfillment_method,delivery_window,zone,total_cents,custom_request,operator_note,payment_provider,payment_status,version,prep_started_at,ready_at,picked_up_at,cancelled_at,created_at,updated_at,order_items(id,order_id,menu_item_id,name,quantity,notes,unit_price_cents)";
const INVENTORY_SELECT = "id,name,unit,on_hand_qty,par_level,status,notes,updated_at";
const MENU_SELECT = "id,slug,name,category,price_cents,availability,allocation_limit,description,image_url,image_path,image_bucket,sort_order,is_featured,is_active,notes,calories,protein_g,carbs_g,fat_g,updated_at";
const CUSTOMER_SELECT = "id,name,email,zone,total_orders,lifetime_value_cents,loyalty_tier,notes,updated_at";
const INSIGHT_SELECT = "id,type,title,summary,confidence,action_text,created_at";
const REMINDER_SELECT = "id,email,source,signup_location,status,notes,last_requested_at,created_at,updated_at";

type Row = Record<string, unknown>;
type SupabaseServerClient = NonNullable<ReturnType<typeof createSupabaseServerClient>>;

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as unknown as Row[]) : [];
}

function readBoundedIntegerEnv(name: string, fallback: number, min: number, max: number) {
  const parsed = Number(process.env[name]);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function shouldUseMockData() {
  const raw = process.env.NEXT_PUBLIC_USE_MOCK_DATA?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

function hasSupabaseDataConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  return value.trim() || null;
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

function normalizeMenuAvailability(value: unknown): MenuItem["availability"] {
  const raw = readString(value).trim().toLowerCase().replace(/[_-]+/g, " ");
  if (["live", "active", "available", "enabled", "true"].includes(raw)) return "Live";
  if (["watch", "draft", "pending"].includes(raw)) return "Watch";
  if (["paused", "pause", "inactive", "disabled", "false"].includes(raw)) return "Paused";
  if (["sold out", "soldout", "out", "unavailable"].includes(raw)) return "Sold Out";
  return "Live";
}

function resolveMenuAvailability(row: Row): MenuItem["availability"] {
  const availability = normalizeMenuAvailability(row.availability);
  if (row.is_active === true) return "Live";
  if (row.is_active === false && availability === "Live") return "Paused";
  return availability;
}

function resolveMenuImageUrl(client: SupabaseServerClient, row: Row) {
  const stored = readNullableString(row.image_url);
  if (stored) return stored;

  const path = readNullableString(row.image_path);
  if (!path) return null;

  const bucket = readNullableString(row.image_bucket) || DEFAULT_IMAGE_BUCKET;
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl || null;
}

function mapOrderItem(row: Row): OrderItem {
  return {
    id: readString(row.id, crypto.randomUUID()),
    orderId: readString(row.order_id),
    menuItemId: readNullableString(row.menu_item_id),
    name: readString(row.name, "Unknown Item"),
    quantity: readNumber(row.quantity, 1),
    notes: readNullableString(row.notes),
    unitPriceCents: readNumber(row.unit_price_cents),
  };
}

function mapOrder(row: Row): Order {
  const id = readString(row.id, crypto.randomUUID());
  const createdAt = readString(row.created_at, new Date().toISOString());
  return {
    id,
    orderNumber: readString(row.order_number, id),
    customerName: readString(row.customer_name, "Unknown Customer"),
    customerEmail: readNullableString(row.customer_email),
    customerZone: readString(row.zone, "Northern Virginia"),
    status: normalizeOrderStatus(row.status) ?? "New",
    serviceDate: readNullableString(row.service_date),
    legacyDropDay: readNullableString(row.drop_day),
    fulfillmentMethod:
      readString(row.fulfillment_method, "pickup").toLowerCase() === "delivery"
        ? "delivery"
        : "pickup",
    serviceWindow: readString(
      row.delivery_window,
      "Pickup details confirmed after checkout",
    ),
    totalCents: readNumber(row.total_cents),
    customRequest: readNullableString(row.custom_request),
    operatorNote: readNullableString(row.operator_note),
    paymentProvider: readString(row.payment_provider, "Stripe"),
    paymentStatus: readString(row.payment_status, "unpaid"),
    version: readNumber(row.version),
    prepStartedAt: readNullableString(row.prep_started_at),
    readyAt: readNullableString(row.ready_at),
    pickedUpAt: readNullableString(row.picked_up_at),
    cancelledAt: readNullableString(row.cancelled_at),
    createdAt,
    updatedAt: readString(row.updated_at, createdAt),
    items: asRows(row.order_items).map(mapOrderItem),
  };
}

function mapInventoryItem(row: Row, linkedMenuItems: InventoryLinkedMenuItem[]): InventoryItem {
  return {
    id: readString(row.id, crypto.randomUUID()),
    name: readString(row.name, "Unknown Inventory Item"),
    unit: readString(row.unit, "units"),
    onHand: readNumber(row.on_hand_qty),
    parLevel: readNumber(row.par_level),
    status: capitalizeWords(readString(row.status), "Watch") as InventoryItem["status"],
    lastUpdatedAt: readString(row.updated_at, new Date().toISOString()),
    notes: readNullableString(row.notes),
    linkedMenuItems,
  };
}

function mapMenuItem(client: SupabaseServerClient, row: Row): MenuItem {
  const slug = readString(row.slug, readString(row.id, crypto.randomUUID()));
  return {
    id: readString(row.id, slug),
    slug,
    name: readString(row.name, "Unknown Menu Item"),
    category: readString(row.category, "Menu"),
    priceCents: readNumber(row.price_cents),
    availability: resolveMenuAvailability(row),
    allocationLimit: readNumber(row.allocation_limit),
    description: readString(row.description),
    imageUrl: resolveMenuImageUrl(client, row),
    storedImageUrl: readNullableString(row.image_url),
    imagePath: readNullableString(row.image_path),
    imageBucket: readNullableString(row.image_bucket),
    sortOrder: readNumber(row.sort_order),
    isFeatured: row.is_featured === true,
    isActive: typeof row.is_active === "boolean" ? row.is_active : null,
    notes: readNullableString(row.notes),
    calories: row.calories == null ? null : readNumber(row.calories),
    proteinG: row.protein_g == null ? null : readNumber(row.protein_g),
    carbsG: row.carbs_g == null ? null : readNumber(row.carbs_g),
    fatG: row.fat_g == null ? null : readNumber(row.fat_g),
  };
}

function mapCustomer(row: Row): Customer {
  const loyalty = capitalizeWords(readString(row.loyalty_tier), "Early");
  return {
    id: readString(row.id, crypto.randomUUID()),
    name: readString(row.name, "Unknown Customer"),
    email: readNullableString(row.email),
    zone: readString(row.zone, "Northern Virginia"),
    totalOrders: readNumber(row.total_orders),
    lifetimeValueCents: readNumber(row.lifetime_value_cents),
    loyaltyTier: (loyalty === "New" ? "Early" : loyalty) as Customer["loyaltyTier"],
    notes: readNullableString(row.notes),
    lastOrderAt: readString(row.updated_at, new Date().toISOString()),
  };
}

function mapEmailUpdate(row: Row): EmailUpdate {
  const createdAt = readString(row.created_at, new Date().toISOString());
  return {
    id: readString(row.id, crypto.randomUUID()),
    email: readString(row.email),
    source: readString(row.source, "website"),
    signupLocation: readNullableString(row.signup_location),
    status: capitalizeWords(readString(row.status), "Active") as EmailUpdate["status"],
    notes: readNullableString(row.notes),
    lastRequestedAt: readString(row.last_requested_at, createdAt),
    createdAt,
    updatedAt: readString(row.updated_at, createdAt),
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
  const tones: Record<Insight["type"], Insight["tone"]> = {
    prep: "success",
    demand: "warning",
    ops: "danger",
    content: "info",
  };
  return {
    id: readString(row.id, crypto.randomUUID()),
    type,
    title: readString(row.title, "Untitled Insight"),
    summary: readString(row.summary),
    confidence: readNumber(row.confidence),
    actionText: readString(row.action_text, "No action recorded."),
    tone: tones[type],
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
  if (!serviceDate) return "Unscheduled";
  const parsed = new Date(`${serviceDate}T12:00:00`);
  if (!Number.isFinite(parsed.getTime())) return "Unscheduled";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function deriveOperationsSnapshot(orders: Order[]): DashboardSnapshot["operations"] {
  const activeOrders = orders.filter((order) =>
    ["New", "In Prep", "Ready"].includes(order.status),
  );

  if (!activeOrders.length) {
    return {
      serviceDateLabel: "Upcoming",
      status: "No active orders",
      queueSummary: "The live kitchen queue is clear",
      serviceWindow: "Pickup details confirmed after checkout",
    };
  }

  const businessDate = getBusinessDate();
  const futureDates = Array.from(
    new Set(
      activeOrders
        .map((order) => order.serviceDate)
        .filter((date): date is string => Boolean(date)),
    ),
  )
    .filter((date) => date >= businessDate)
    .sort();
  const selectedDate = futureDates[0] ?? null;
  const selectedOrders = selectedDate
    ? activeOrders.filter((order) => order.serviceDate === selectedDate)
    : activeOrders.filter((order) => !order.serviceDate);
  const operationalOrders = selectedOrders.length ? selectedOrders : activeOrders;
  const windows = Array.from(
    new Set(operationalOrders.map((order) => order.serviceWindow).filter(Boolean)),
  );

  return {
    serviceDateLabel: formatServiceDateLabel(selectedDate),
    status: "Orders Active",
    queueSummary: `${operationalOrders.length} active order${operationalOrders.length === 1 ? "" : "s"} for the selected service run`,
    serviceWindow:
      windows.length === 0
        ? "Window pending"
        : windows.length === 1
          ? windows[0]
          : `${windows.length} pickup windows`,
  };
}

function deriveKpis(orders: Order[], inventory: InventoryItem[]): DashboardSnapshot["kpis"] {
  const todayOrders = getOrdersForBusinessDate(orders);
  const recognizedRevenueCents = getRecognizedRevenueCents(orders);
  const lowStockCount = inventory.filter(
    (item) => item.status === "Low" || item.status === "Out",
  ).length;
  const inventoryHealth = getInventoryHealthPercent(inventory);

  return [
    {
      label: "Today's Service Orders",
      value: String(todayOrders.length),
      delta: "Non-cancelled orders scheduled for today",
      tone: "gold",
    },
    {
      label: "Paid Revenue To Date",
      value: formatCompactCurrency(recognizedRevenueCents),
      delta: "Excludes unpaid and cancelled orders",
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

function logQueryError(section: string, error: { code?: string; message?: string } | null) {
  if (!error) return;
  console.error("[dashboard-data] query failed", {
    section,
    code: error.code,
    message: error.message,
  });
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
      remindersResponse,
    ] = await Promise.all([
      client.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(ORDER_HISTORY_LIMIT),
      client.from("inventory_items").select(INVENTORY_SELECT).order("name").limit(1000),
      client.from("menu_items").select(MENU_SELECT).order("sort_order").limit(1000),
      client.from("customers").select(CUSTOMER_SELECT).order("updated_at", { ascending: false }).limit(CUSTOMER_LIMIT),
      client.from("insights").select(INSIGHT_SELECT).eq("is_active", true).order("created_at", { ascending: false }).limit(INSIGHT_LIMIT),
      client.from("inventory_item_menu_links").select("inventory_item_id,menu_item_id").limit(5000),
      client.from("drop_reminders").select(REMINDER_SELECT).order("last_requested_at", { ascending: false }).limit(SUBSCRIBER_LIMIT),
    ]);

    const criticalErrors = [
      ["orders", ordersResponse.error],
      ["inventory", inventoryResponse.error],
      ["menu", menuResponse.error],
    ] as const;
    for (const [section, error] of criticalErrors) logQueryError(section, error);
    if (criticalErrors.some(([, error]) => Boolean(error))) return null;

    logQueryError("customers", customersResponse.error);
    logQueryError("insights", insightsResponse.error);
    logQueryError("inventory-links", inventoryLinksResponse.error);
    logQueryError("subscribers", remindersResponse.error);

    const orders = asRows(ordersResponse.data).map(mapOrder);
    const menuRows = asRows(menuResponse.data);
    const menu = menuRows.map((row) => mapMenuItem(client, row));
    const menuById = new Map(
      menuRows.map((row) => {
        const id = readString(row.id);
        return [id, { id: id || crypto.randomUUID(), name: readString(row.name, "Unknown Menu Item") }];
      }),
    );
    const linkedByInventoryId = new Map<string, InventoryLinkedMenuItem[]>();

    if (!inventoryLinksResponse.error) {
      for (const row of asRows(inventoryLinksResponse.data)) {
        const inventoryItemId = readString(row.inventory_item_id);
        const menuItemId = readString(row.menu_item_id);
        const linked = menuById.get(menuItemId);
        if (!inventoryItemId || !linked) continue;
        const existing = linkedByInventoryId.get(inventoryItemId) ?? [];
        existing.push(linked);
        linkedByInventoryId.set(inventoryItemId, existing);
      }
    }

    const inventory = asRows(inventoryResponse.data).map((row) =>
      mapInventoryItem(row, linkedByInventoryId.get(readString(row.id)) ?? []),
    );
    const customers = customersResponse.error
      ? []
      : asRows(customersResponse.data).map(mapCustomer);
    const emailUpdates = remindersResponse.error
      ? []
      : asRows(remindersResponse.data).map(mapEmailUpdate);
    const insights = insightsResponse.error
      ? []
      : asRows(insightsResponse.data).map(mapInsight);

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
  } catch (error) {
    console.error("[dashboard-data] unexpected load failure", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function loadDashboardDataState(): Promise<DashboardDataState> {
  if (shouldUseMockData()) {
    return { snapshot: cloneMockSnapshot(), dataSource: "mock", dataIssue: null };
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
  if (remote) return { snapshot: remote, dataSource: "supabase", dataIssue: null };

  return {
    snapshot: null,
    dataSource: "supabase",
    dataIssue:
      "Critical operations data could not be loaded. Check deployment logs and verify the required database migration is applied.",
  };
}

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot> {
  const result = await loadDashboardDataState();
  if (result.snapshot) return result.snapshot;
  throw new Error(result.dataIssue ?? "Dashboard data unavailable.");
}

export function getDataSourceKind(): DataSourceKind {
  return shouldUseMockData() ? "mock" : "supabase";
}

export function getMockDashboardSnapshot(): DashboardSnapshot {
  return cloneMockSnapshot();
}
