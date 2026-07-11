import { formatDurationLabel, type FulfillmentSpeedStats, type RepeatCustomerStats } from "@/lib/dashboard/analytics";

interface FulfillmentAnalyticsCardsProps {
  repeatCustomerStats: RepeatCustomerStats;
  fulfillmentSpeedStats: FulfillmentSpeedStats;
}

export function FulfillmentAnalyticsCards({
  repeatCustomerStats,
  fulfillmentSpeedStats,
}: FulfillmentAnalyticsCardsProps) {
  return (
    <>
      <article className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">Customer Loyalty</p>
            <h2 className="card-title">Repeat Customer Rate</h2>
          </div>
        </div>
        <div className="kpi-value">{repeatCustomerStats.ratePercent}%</div>
        <div className="stack-item-meta">
          {repeatCustomerStats.repeatCount} of {repeatCustomerStats.totalCount} tracked customers have ordered more than once
        </div>
      </article>

      <article className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">Operations</p>
            <h2 className="card-title">Fulfillment Speed</h2>
          </div>
        </div>
        <div className="kpi-value">
          {fulfillmentSpeedStats.averageMinutes === null
            ? "—"
            : formatDurationLabel(fulfillmentSpeedStats.averageMinutes).replace(" avg turnaround", "")}
        </div>
        <div className="stack-item-meta">
          {fulfillmentSpeedStats.sampleSize
            ? `Est. queue-to-pickup time across ${fulfillmentSpeedStats.sampleSize} completed order${fulfillmentSpeedStats.sampleSize === 1 ? "" : "s"}${fulfillmentSpeedStats.excludedCount ? ` (${fulfillmentSpeedStats.excludedCount} excluded as stale)` : ""}`
            : "No completed pickups yet to measure"}
        </div>
      </article>
    </>
  );
}
