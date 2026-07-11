import type { Customer, Order } from "@/types/domain";

export interface BestSellerRow {
  name: string;
  quantity: number;
  revenueCents: number;
}

export function getBestSellers(orders: Order[], limit = 8): BestSellerRow[] {
  const totals = new Map<string, { quantity: number; revenueCents: number }>();

  for (const order of orders) {
    if (order.status === "Cancelled") continue;

    for (const item of order.items) {
      const name = (item.name || "Unknown item").trim() || "Unknown item";
      const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
      const revenueCents = Number.isFinite(item.unitPriceCents) ? item.unitPriceCents * quantity : 0;

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
  const totalCount = customers.length;
  const repeatCount = customers.filter((customer) => customer.totalOrders > 1).length;
  const ratePercent = totalCount ? Math.round((repeatCount / totalCount) * 100) : 0;

  return { repeatCount, totalCount, ratePercent };
}

export interface FulfillmentSpeedStats {
  averageMinutes: number | null;
  sampleSize: number;
  excludedCount: number;
}

// Orders don't have a dedicated "picked up at" timestamp, so this uses
// updated_at as a proxy for pickup time. That's a reasonable estimate right
// after a status change, but any later edit (a note, a re-save) also bumps
// updated_at, which can make an order look like it took days or weeks.
// Since this is a same/next-day pickup business, gaps beyond 72 hours are
// almost certainly stale edits rather than real turnaround time, so they're
// excluded rather than allowed to skew the average.
const MAX_PLAUSIBLE_TURNAROUND_MINUTES = 72 * 60;

export function getAverageFulfillmentMinutes(orders: Order[]): FulfillmentSpeedStats {
  const samples: number[] = [];
  let excludedCount = 0;

  for (const order of orders) {
    if (order.status !== "Picked Up") continue;

    const created = new Date(order.createdAt).getTime();
    const updated = new Date(order.updatedAt).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(updated)) continue;

    const minutes = (updated - created) / 60000;
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
