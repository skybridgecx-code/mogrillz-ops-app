export type ViewKey = "today" | "orders" | "inventory" | "menu" | "customers" | "analytics";

export interface DashboardNavItem {
  key: ViewKey;
  label: string;
  short: string;
  description: string;
}

export const DASHBOARD_NAV: readonly DashboardNavItem[] = [
  {
    key: "today",
    label: "Command Center",
    short: "Command",
    description: "Prioritized orders, inventory pressure, and the operating picture for the current service day.",
  },
  {
    key: "orders",
    label: "Orders",
    short: "Orders",
    description: "Move tickets through the kitchen workflow and inspect each customer request.",
  },
  {
    key: "inventory",
    label: "Inventory",
    short: "Stock",
    description: "Review stock against par and update ingredient counts before service.",
  },
  {
    key: "menu",
    label: "Menu",
    short: "Menu",
    description: "Manage the dishes and availability shown on the public ordering site.",
  },
  {
    key: "customers",
    label: "Customers & Activity",
    short: "Customers",
    description: "Review customer records, subscriber context, and recorded order-status activity.",
  },
  {
    key: "analytics",
    label: "Analytics",
    short: "Trends",
    description: "Understand sales, customer retention, and order-flow performance.",
  },
] as const;

export const VIEW_TITLES: Record<ViewKey, string> = {
  today: "Command Center",
  orders: "Order Board",
  inventory: "Inventory",
  menu: "Menu Studio",
  customers: "Customers & Activity",
  analytics: "Analytics",
};

const VIEW_KEYS = new Set<ViewKey>(DASHBOARD_NAV.map((item) => item.key));

export function isViewKey(value: string): value is ViewKey {
  return VIEW_KEYS.has(value as ViewKey);
}
