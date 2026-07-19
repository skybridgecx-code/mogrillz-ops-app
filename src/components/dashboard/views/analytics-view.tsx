"use client";

import { useMemo } from "react";

import { formatCurrency } from "@/lib/dashboard/format";
import {
  formatDurationLabel,
  getAverageFulfillmentMinutes,
  getBestSellers,
  getRepeatCustomerRate,
} from "@/lib/dashboard/analytics";
import type { Customer, Order } from "@/types/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

function Sparkline({ values }: { values: number[] }) {
  const width = 300;
  const height = 64;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - 6 - (value / max) * (height - 14);
    return `${x},${y}`;
  });

  return (
    <svg className="spark" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(242,178,52,0.35)" />
          <stop offset="100%" stopColor="rgba(242,178,52,0)" />
        </linearGradient>
      </defs>
      <polygon fill="url(#sparkFill)" points={`0,${height} ${points.join(" ")} ${width},${height}`} />
      <polyline
        fill="none"
        points={points.join(" ")}
        stroke="var(--gold)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

export function AnalyticsView({ orders, customers }: { orders: Order[]; customers: Customer[] }) {
  const bestSellers = useMemo(() => getBestSellers(orders), [orders]);
  const repeat = useMemo(() => getRepeatCustomerRate(customers), [customers]);
  const speed = useMemo(() => getAverageFulfillmentMinutes(orders), [orders]);

  const revenue = useMemo(() => {
    const validOrders = orders.filter((order) => order.status !== "Cancelled");
    const total = validOrders.reduce((sum, order) => sum + order.totalCents, 0);
    const average = validOrders.length ? Math.round(total / validOrders.length) : 0;

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const days: number[] = new Array(14).fill(0);
    let last7 = 0;

    for (const order of validOrders) {
      const created = new Date(order.createdAt).getTime();
      if (!Number.isFinite(created)) continue;
      const dayIndex = Math.floor((start - created) / DAY_MS);
      if (dayIndex >= 0 && dayIndex < 14) {
        days[13 - dayIndex] += order.totalCents;
        if (dayIndex < 7) last7 += order.totalCents;
      }
    }

    return { total, average, days, last7, count: validOrders.length };
  }, [orders]);

  const maxSeller = Math.max(...bestSellers.map((row) => row.quantity), 1);

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="kpi gold">
          <div className="kpi-label">Revenue · last 7 days</div>
          <div className="kpi-value">{formatCurrency(revenue.last7)}</div>
          <div className="kpi-delta">{revenue.count} orders all-time</div>
        </div>
        <div className="kpi green">
          <div className="kpi-label">Average order</div>
          <div className="kpi-value">{formatCurrency(revenue.average)}</div>
          <div className="kpi-delta">across non-cancelled orders</div>
        </div>
        <div className="kpi blue">
          <div className="kpi-label">Repeat customers</div>
          <div className="kpi-value">{repeat.ratePercent}%</div>
          <div className="kpi-delta">{repeat.repeatCount} of {repeat.totalCount} ordered again</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Order turnaround</div>
          <div className="kpi-value" style={{ fontSize: "1.1rem", lineHeight: "1.9rem" }}>
            {formatDurationLabel(speed.averageMinutes)}
          </div>
          <div className="kpi-delta">{speed.sampleSize} completed orders measured</div>
        </div>
      </div>

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <div>
              <p className="kicker">Momentum</p>
              <h3 className="card-title">Revenue · last 14 days</h3>
            </div>
            <span className="pill warning">{formatCurrency(revenue.days.reduce((sum, value) => sum + value, 0))}</span>
          </div>
          {revenue.days.some((value) => value > 0) ? (
            <Sparkline values={revenue.days} />
          ) : (
            <p className="muted" style={{ margin: 0 }}>No orders in the last two weeks yet — this chart fills in as sales come through.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <p className="kicker">Best sellers</p>
              <h3 className="card-title">What&rsquo;s actually selling</h3>
            </div>
          </div>
          {bestSellers.length ? (
            bestSellers.map((row) => (
              <div className="bar-row" key={row.name}>
                <span className="bar-name">{row.name}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max((row.quantity / maxSeller) * 100, 6)}%` }} />
                </div>
                <span className="bar-val">{row.quantity}× · {formatCurrency(row.revenueCents)}</span>
              </div>
            ))
          ) : (
            <p className="muted" style={{ margin: 0 }}>Rankings appear after your first orders.</p>
          )}
        </section>
      </div>
    </div>
  );
}
