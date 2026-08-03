import { isActiveOrder } from "@/lib/dashboard/format";
import type {
  Customer,
  DashboardSnapshot,
  EmailUpdate,
  Insight,
  InventoryItem,
  MenuItem,
  Order,
  OrderStatusEvent,
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
  activity: OrderStatusEvent[];
  optionalSources: DashboardSnapshot["optionalSources"];
  activityScope: DashboardSnapshot["activityScope"];
}

export interface ReportsReadModel {
  generatedAt: string;
  customers: Customer[];
  orders: Order[];
}

export interface DashboardReadModels {
  today: TodayReadModel;
  orders: OrdersReadModel;
  inventory: InventoryReadModel;
  menu: MenuReadModel;
  customers: CustomersReadModel;
  reports: ReportsReadModel;
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
      activity: snapshot.activity,
      optionalSources: snapshot.optionalSources,
      activityScope: snapshot.activityScope,
    },
    reports: {
      generatedAt: snapshot.generatedAt,
      customers: snapshot.customers,
      orders: snapshot.orders,
    },
  };
}
