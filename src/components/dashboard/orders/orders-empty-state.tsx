interface OrdersEmptyStateProps {
  onReset: () => void;
}

export function OrdersEmptyState({
  onReset,
}: OrdersEmptyStateProps) {
  return (
    <div className="detail-panel" style={{ minHeight: "240px", justifyContent: "center" }}>
      <div className="detail-hero">
        <h3>No matching orders</h3>
        <p>There are no orders that match the current status and fulfillment filters.</p>
      </div>
      <div className="detail-note">
        <strong>Try resetting filters</strong>
        Reset to show the full live queue again.
      </div>
      <div className="detail-actions">
        <button className="topbar-action" onClick={onReset} type="button">Reset filters</button>
      </div>
    </div>
  );
}
