import type { FulfillmentSummary } from "@/lib/dashboard/fulfillment-summary";

interface FulfillmentAnalyticsCardsProps {
  fulfillmentSummary: FulfillmentSummary;
  formatCurrency: (cents: number) => string;
}

export function FulfillmentAnalyticsCards({
  fulfillmentSummary,
  formatCurrency,
}: FulfillmentAnalyticsCardsProps) {
  return (
    <>
      <article className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">Fulfillment Mix</p>
            <h2 className="card-title">Delivery Orders</h2>
          </div>
        </div>
        <div className="kpi-value">{fulfillmentSummary.deliveryCount}</div>
        <div className="stack-item-meta">{formatCurrency(fulfillmentSummary.deliveryRevenue)} in delivery revenue</div>
      </article>

      <article className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">Fulfillment Mix</p>
            <h2 className="card-title">Pickup Orders</h2>
          </div>
        </div>
        <div className="kpi-value">{fulfillmentSummary.pickupCount}</div>
        <div className="stack-item-meta">{formatCurrency(fulfillmentSummary.pickupRevenue)} in pickup revenue</div>
      </article>
    </>
  );
}
