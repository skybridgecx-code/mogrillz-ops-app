export type OrderStatus = "New" | "In Prep" | "Ready" | "Picked Up" | "Cancelled";

export type FulfillmentMethod = "delivery" | "pickup";

export type InventoryStatus = "Healthy" | "Watch" | "Low" | "Out";

export type MenuAvailability = "Live" | "Watch" | "Paused" | "Sold Out";

export type InsightTone = "success" | "warning" | "danger" | "info";

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string | null;
  name: string;
  quantity: number;
  notes: string | null;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerZone: string;
  status: OrderStatus;
  serviceDate: string | null;
  legacyDropDay: string | null;
  fulfillmentMethod: FulfillmentMethod;
  serviceWindow: string;
  totalCents: number;
  customRequest: string | null;
  operatorNote?: string | null;
  paymentProvider: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface InventoryLinkedMenuItem {
  id: string;
  name: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  parLevel: number;
  status: InventoryStatus;
  lastUpdatedAt: string;
  notes: string | null;
  linkedMenuItems: InventoryLinkedMenuItem[];
}

export interface MenuItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  availability: MenuAvailability;
  allocationLimit: number;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  isFeatured: boolean;
  notes: string | null;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  zone: string;
  totalOrders: number;
  lifetimeValueCents: number;
  loyaltyTier: "Early" | "Rising" | "High" | "VIP";
  notes: string | null;
  lastOrderAt: string;
}

export interface EmailUpdate {
  id: string;
  email: string;
  source: string;
  signupLocation: string | null;
  status: "Active" | "Unsubscribed";
  notes: string | null;
  lastRequestedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Insight {
  id: string;
  type: "prep" | "demand" | "ops" | "content";
  title: string;
  summary: string;
  confidence: number;
  actionText: string;
  tone: InsightTone;
  createdAt: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  operations: {
    serviceDateLabel: string;
    status: string;
    queueSummary: string;
    serviceWindow: string;
  };
  kpis: Array<{
    label: string;
    value: string;
    delta: string;
    tone: "gold" | "green" | "red" | "blue";
  }>;
  orders: Order[];
  inventory: InventoryItem[];
  menu: MenuItem[];
  customers: Customer[];
  emailUpdates: EmailUpdate[];
  insights: Insight[];
}
