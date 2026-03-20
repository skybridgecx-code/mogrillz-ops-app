interface FulfillmentAnalyticsCardsProps {
  deliveryCount: number;
  pickupCount: number;
  deliveryRevenue: number;
  pickupRevenue: number;
  formatCurrency: (cents: number) => string;
}

export function FulfillmentAnalyticsCards({
  deliveryCount,
  pickupCount,
  deliveryRevenue,
  pickupRevenue,
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
        <div className="kpi-value">{deliveryCount}</div>
        <div className="stack-item-meta">{formatCurrency(deliveryRevenue)} in delivery revenue</div>
      </article>

      <article className="card">
        <div className="card-head">
          <div>
            <p className="card-kicker">Fulfillment Mix</p>
            <h2 className="card-title">Pickup Orders</h2>
          </div>
        </div>
        <div className="kpi-value">{pickupCount}</div>
        <div className="stack-item-meta">{formatCurrency(pickupRevenue)} in pickup revenue</div>
      </article>
    </>
  );
}
