export type ViewKey = "today" | "orders" | "inventory" | "menu" | "customers" | "analytics";

export interface DashboardNavItem {
  key: ViewKey;
  label: string;
  short: string;
  icon: string;
  description: string;
}

export const DASHBOARD_NAV: readonly DashboardNavItem[] = [
  {
    key: "today",
    label: "Today",
    short: "Today",
    icon: "🔥",
    description: "What needs you right now — orders in motion, stock pressure, and the day's pulse.",
  },
  {
    key: "orders",
    label: "Orders",
    short: "Orders",
    icon: "🧾",
    description: "Move tickets from new to picked up. Tap a card for the full order.",
  },
  {
    key: "inventory",
    label: "Inventory",
    short: "Stock",
    icon: "📦",
    description: "Stock levels against par. Tap an ingredient to adjust counts in seconds.",
  },
  {
    key: "menu",
    label: "Menu",
    short: "Menu",
    icon: "🍽️",
    description: "What customers see on the live site. Edit, pause, or add dishes — no code.",
  },
  {
    key: "customers",
    label: "Customers",
    short: "People",
    icon: "👥",
    description: "Your regulars, VIPs, and everyone waiting on the next menu update.",
  },
  {
    key: "analytics",
    label: "Analytics",
    short: "Trends",
    icon: "📈",
    description: "What's selling, who's coming back, and how fast orders move.",
  },
] as const;

export const VIEW_TITLES: Record<ViewKey, string> = {
  today: "Today",
  orders: "Order Board",
  inventory: "Inventory",
  menu: "Menu Studio",
  customers: "Customers",
  analytics: "Analytics",
};

const VIEW_KEYS = new Set<ViewKey>(DASHBOARD_NAV.map((item) => item.key));

export function isViewKey(value: string): value is ViewKey {
  return VIEW_KEYS.has(value as ViewKey);
}
