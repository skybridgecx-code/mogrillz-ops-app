import type { FulfillmentSummary } from "@/lib/dashboard/fulfillment-summary";

interface FulfillmentSummaryCardsProps {
  fulfillmentSummary: FulfillmentSummary;
  formatCurrency: (cents: number) => string;
}

export function FulfillmentSummaryCards({
  fulfillmentSummary,
  formatCurrency,
}: FulfillmentSummaryCardsProps) {
  return (
    <>
      <article className="card kpi-card">
        <div className="kpi-label">Delivery Orders</div>
        <div className="kpi-value">{fulfillmentSummary.deliveryCount}</div>
        <div className="kpi-delta">{formatCurrency(fulfillmentSummary.deliveryRevenue)} in delivery revenue</div>
      </article>
      <article className="card kpi-card">
        <div className="kpi-label">Pickup Orders</div>
        <div className="kpi-value">{fulfillmentSummary.pickupCount}</div>
        <div className="kpi-delta">{formatCurrency(fulfillmentSummary.pickupRevenue)} in pickup revenue</div>
      </article>
    </>
  );
}
