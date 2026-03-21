export type DropDay = "Monday" | "Wednesday" | "Friday";

export type OrderStatus = "New" | "In Prep" | "Ready" | "Delivered" | "Cancelled";

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
  dropDay: DropDay;
  fulfillmentMethod: FulfillmentMethod;
  deliveryWindow: string;
  totalCents: number;
  customRequest: string | null;
  operatorNote?: string | null;
  paymentProvider: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
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
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  availability: MenuAvailability;
  allocationLimit: number;
  description: string;
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
  drop: {
    day: DropDay;
    status: string;
    window: string;
    cutoff: string;
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
  insights: Insight[];
}
