import { formatDurationLabel, type FulfillmentSpeedStats, type RepeatCustomerStats } from "@/lib/dashboard/analytics";

interface FulfillmentSummaryCardsProps {
  repeatCustomerStats: RepeatCustomerStats;
  fulfillmentSpeedStats: FulfillmentSpeedStats;
}

export function FulfillmentSummaryCards({
  repeatCustomerStats,
  fulfillmentSpeedStats,
}: FulfillmentSummaryCardsProps) {
  return (
    <>
      <article className="card kpi-card">
        <div className="kpi-label">Repeat Customer Rate</div>
        <div className="kpi-value">{repeatCustomerStats.ratePercent}%</div>
        <div className="kpi-delta">
          {repeatCustomerStats.repeatCount} of {repeatCustomerStats.totalCount} tracked customers have ordered more than once
        </div>
      </article>
      <article className="card kpi-card">
        <div className="kpi-label">Fulfillment Speed</div>
        <div className="kpi-value">
          {fulfillmentSpeedStats.averageMinutes === null
            ? "—"
            : formatDurationLabel(fulfillmentSpeedStats.averageMinutes).replace(" avg turnaround", "")}
        </div>
        <div className="kpi-delta">
          {fulfillmentSpeedStats.sampleSize
            ? `Est. queue-to-pickup time across ${fulfillmentSpeedStats.sampleSize} completed order${fulfillmentSpeedStats.sampleSize === 1 ? "" : "s"}${fulfillmentSpeedStats.excludedCount ? ` (${fulfillmentSpeedStats.excludedCount} excluded as stale)` : ""}`
            : "No completed pickups yet to measure"}
        </div>
      </article>
    </>
  );
}
