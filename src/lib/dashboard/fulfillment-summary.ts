import type { Order } from "@/types/domain";

export interface FulfillmentSummary {
  deliveryCount: number;
  pickupCount: number;
  deliveryRevenue: number;
  pickupRevenue: number;
}

export function getFulfillmentSummary(orders: Order[]): FulfillmentSummary {
  const deliveryOrders = orders.filter((order) => order.fulfillmentMethod === "pickup");
  const pickupOrders = orders.filter((order) => order.fulfillmentMethod === "pickup");

  return {
    deliveryCount: deliveryOrders.length,
    pickupCount: pickupOrders.length,
    deliveryRevenue: deliveryOrders.reduce((sum, order) => sum + order.totalCents, 0),
    pickupRevenue: pickupOrders.reduce((sum, order) => sum + order.totalCents, 0),
  };
}
