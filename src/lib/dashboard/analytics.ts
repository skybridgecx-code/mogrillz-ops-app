import { isRecognizedRevenueOrder } from "@/lib/dashboard/metrics";
import type { Customer, Order } from "@/types/domain";

export interface BestSellerRow {
  name: string;
  quantity: number;
  revenueCents: number;
}

export function getBestSellers(orders: Order[], limit = 8): BestSellerRow[] {
  const totals = new Map<string, { quantity: number; revenueCents: number }>();

  for (const order of orders) {
    if (!isRecognizedRevenueOrder(order)) continue;

    for (const item of order.items) {
      const name = (item.name || "Unknown item").trim() || "Unknown item";
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
      const revenueCents = Number.isFinite(item.unitPriceCents)
        ? item.unitPriceCents * quantity
        : 0;

      const existing = totals.get(name) ?? { quantity: 0, revenueCents: 0 };
      totals.set(name, {
        quantity: existing.quantity + quantity,
        revenueCents: existing.revenueCents + revenueCents,
      });
    }
  }

  return [...totals.entries()]
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((left, right) => right.quantity - left.quantity || right.revenueCents - left.revenueCents)
    .slice(0, limit);
}

export interface RepeatCustomerStats {
  repeatCount: number;
  totalCount: number;
  ratePercent: number;
}

export function getRepeatCustomerRate(customers: Customer[]): RepeatCustomerStats {
  const customersWithOrders = customers.filter((customer) => customer.totalOrders > 0);
  const totalCount = customersWithOrders.length;
  const repeatCount = customersWithOrders.filter((customer) => customer.totalOrders > 1).length;
  const ratePercent = totalCount ? Math.round((repeatCount / totalCount) * 100) : 0;

  return { repeatCount, totalCount, ratePercent };
}

export interface FulfillmentSpeedStats {
  averageMinutes: number | null;
  sampleSize: number;
  excludedCount: number;
}

const MAX_PLAUSIBLE_TURNAROUND_MINUTES = 72 * 60;

export function getAverageFulfillmentMinutes(orders: Order[]): FulfillmentSpeedStats {
  const samples: number[] = [];
  let excludedCount = 0;

  for (const order of orders) {
    if (order.status !== "Picked Up" || !order.pickedUpAt) continue;

    const created = new Date(order.createdAt).getTime();
    const pickedUp = new Date(order.pickedUpAt).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(pickedUp)) continue;

    const minutes = (pickedUp - created) / 60000;
    if (minutes <= 0) continue;

    if (minutes > MAX_PLAUSIBLE_TURNAROUND_MINUTES) {
      excludedCount += 1;
      continue;
    }

    samples.push(minutes);
  }

  if (!samples.length) return { averageMinutes: null, sampleSize: 0, excludedCount };

  const averageMinutes = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return { averageMinutes, sampleSize: samples.length, excludedCount };
}

export function formatDurationLabel(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "Not enough data yet";

  const totalMinutes = Math.round(minutes);
  if (totalMinutes < 60) return `${totalMinutes}m avg turnaround`;

  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return remainder ? `${hours}h ${remainder}m avg turnaround` : `${hours}h avg turnaround`;
}
