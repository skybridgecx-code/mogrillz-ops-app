import { isActiveOrder } from "@/lib/dashboard/format";
import type {
  Customer,
  DashboardSnapshot,
  EmailUpdate,
  Insight,
  InventoryItem,
  MenuItem,
  Order,
} from "@/types/domain";

export interface TodayReadModel {
  operations: DashboardSnapshot["operations"];
  kpis: DashboardSnapshot["kpis"];
  orders: Order[];
  insights: Insight[];
  activeOrders: Order[];
  lowStock: InventoryItem[];
}

export interface OrdersReadModel {
  orders: Order[];
}

export interface InventoryReadModel {
  inventory: InventoryItem[];
}

export interface MenuReadModel {
  inventory: InventoryItem[];
  menu: MenuItem[];
}

export interface CustomersReadModel {
  customers: Customer[];
  emailUpdates: EmailUpdate[];
}

export interface AnalyticsReadModel {
  customers: Customer[];
  orders: Order[];
}

export interface DashboardReadModels {
  today: TodayReadModel;
  orders: OrdersReadModel;
  inventory: InventoryReadModel;
  menu: MenuReadModel;
  customers: CustomersReadModel;
  analytics: AnalyticsReadModel;
}

export function createDashboardReadModels(snapshot: DashboardSnapshot): DashboardReadModels {
  const activeOrders = snapshot.orders.filter(isActiveOrder);
  const lowStock = snapshot.inventory.filter(
    (item) => item.status === "Low" || item.status === "Out",
  );

  return {
    today: {
      operations: snapshot.operations,
      kpis: snapshot.kpis,
      orders: snapshot.orders,
      insights: snapshot.insights,
      activeOrders,
      lowStock,
    },
    orders: {
      orders: snapshot.orders,
    },
    inventory: {
      inventory: snapshot.inventory,
    },
    menu: {
      inventory: snapshot.inventory,
      menu: snapshot.menu,
    },
    customers: {
      customers: snapshot.customers,
      emailUpdates: snapshot.emailUpdates,
    },
    analytics: {
      customers: snapshot.customers,
      orders: snapshot.orders,
    },
  };
}
