"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { Panel } from "@/components/foundation/Panel";
import { SectionHeader } from "@/components/foundation/SectionHeader";
import { formatCurrency } from "@/lib/dashboard/format";
import {
  LOADED_SNAPSHOT_DISCLOSURE,
  RECOGNIZED_REVENUE_DISCLOSURE,
  buildReportsWorkspace,
  type DailyCountRow,
  type DailyMoneyRow,
  type ReportRangeMode,
} from "@/lib/dashboard/reports-workspace";
import type { Customer, Order } from "@/types/domain";

type WorkspaceMode = "overview" | "sales" | "operations" | "customers-items";

const MODE_LABELS: Record<WorkspaceMode, string> = {
  overview: "Overview",
  sales: "Sales",
  operations: "Operations",
  "customers-items": "Customers & Items",
};

const RANGE_LABELS: Record<ReportRangeMode, string> = {
  "last-7": "Last 7 business dates",
  "last-30": "Last 30 business dates",
  "all-loaded": "All loaded data",
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(parsed);
}

function formatDuration(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return "Unavailable";
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="frontier-reports__metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function Notice({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" }) {
  return <p className="frontier-reports__notice" data-tone={tone}>{children}</p>;
}

function MoneySeries({ rows, title }: { rows: DailyMoneyRow[]; title: string }) {
  const max = Math.max(...rows.map((row) => row.valueCents), 1);
  return (
    <Panel className="frontier-reports__chart-card">
      <h3>{title}</h3>
      {rows.length ? (
        <>
          <div aria-hidden="true" className="frontier-reports__bars">
            {rows.map((row) => (
              <span
                key={row.dateKey}
                style={{ "--reports-bar-size": `${Math.max((row.valueCents / max) * 100, row.valueCents ? 3 : 0)}%` } as CSSProperties}
              />
            ))}
          </div>
          <div className="frontier-reports__table-wrap">
            <table>
              <caption>{title} values</caption>
              <thead><tr><th scope="col">Eastern date</th><th scope="col">Recognized revenue</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.dateKey}><th scope="row">{row.dateKey}</th><td>{formatCurrency(row.valueCents)}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      ) : <p className="frontier-reports__empty">No valid order-created dates are available for this series.</p>}
    </Panel>
  );
}

function CountSeries({ rows, title, valueLabel }: { rows: DailyCountRow[]; title: string; valueLabel: string }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return (
    <Panel className="frontier-reports__chart-card">
      <h3>{title}</h3>
      {rows.length ? (
        <>
          <div aria-hidden="true" className="frontier-reports__bars">
            {rows.map((row) => (
              <span
                key={row.dateKey}
                style={{ "--reports-bar-size": `${Math.max((row.count / max) * 100, row.count ? 3 : 0)}%` } as CSSProperties}
              />
            ))}
          </div>
          <div className="frontier-reports__table-wrap">
            <table>
              <caption>{title} values</caption>
              <thead><tr><th scope="col">Business date</th><th scope="col">{valueLabel}</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.dateKey}><th scope="row">{row.dateKey}</th><td>{row.count}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      ) : <p className="frontier-reports__empty">No valid business dates are available for this series.</p>}
    </Panel>
  );
}

export function ReportsView({
  generatedAt,
  orders,
  customers,
}: {
  generatedAt: string;
  orders: Order[];
  customers: Customer[];
}) {
  const [mode, setMode] = useState<WorkspaceMode>("overview");
  const [rangeMode, setRangeMode] = useState<ReportRangeMode>("last-7");
  const report = useMemo(
    () => buildReportsWorkspace({ generatedAt, orders, customers, rangeMode }),
    [customers, generatedAt, orders, rangeMode],
  );

  const averageOrder = report.averageRecognizedOrderCents === null
    ? "Unavailable"
    : formatCurrency(report.averageRecognizedOrderCents);
  const repeatRate = report.repeatRatePercent === null ? "Unavailable" : `${report.repeatRatePercent}%`;

  return (
    <div className="frontier-reports">
      <SectionHeader
        description="Read-only reporting over the currently loaded dashboard snapshot, with explicit financial and operations date bases."
        eyebrow="Loaded snapshot reporting"
        title="Reports"
      />

      <div className="frontier-reports__control-grid">
        <fieldset className="frontier-reports__switcher">
          <legend>Report mode</legend>
          <div>
            {(Object.keys(MODE_LABELS) as WorkspaceMode[]).map((value) => (
              <button aria-pressed={mode === value} key={value} onClick={() => setMode(value)} type="button">
                {MODE_LABELS[value]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="frontier-reports__switcher">
          <legend>Date range</legend>
          <div>
            {(Object.keys(RANGE_LABELS) as ReportRangeMode[]).map((value) => (
              <button aria-pressed={rangeMode === value} key={value} onClick={() => setRangeMode(value)} type="button">
                {RANGE_LABELS[value]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <section aria-labelledby="reports-range-heading" className="frontier-reports__range">
        <div>
          <span id="reports-range-heading">Selected range</span>
          <strong>{report.range.visibleLabel}</strong>
        </div>
        <dl>
          <div><dt>Mode</dt><dd>{RANGE_LABELS[report.range.mode]}</dd></div>
          <div><dt>Eastern anchor</dt><dd>{report.range.anchorDate ?? "Unavailable"}</dd></div>
          <div><dt>Start</dt><dd>{report.range.startDate ?? "Unavailable"}</dd></div>
          <div><dt>End</dt><dd>{report.range.endDate ?? "Unavailable"}</dd></div>
          <div><dt>Range type</dt><dd>{report.range.bounded ? "Bounded" : "All loaded"}</dd></div>
        </dl>
      </section>

      <Notice>{RECOGNIZED_REVENUE_DISCLOSURE}</Notice>
      <Notice tone="warning">{LOADED_SNAPSHOT_DISCLOSURE}</Notice>

      {mode === "overview" ? (
        <div className="frontier-reports__mode">
          <section aria-label="Overview metrics" className="frontier-reports__metrics">
            <MetricCard label="Recognized paid revenue" value={formatCurrency(report.recognizedRevenueCents)} detail={`${report.recognizedPaidOrderCount} recognized paid orders`} />
            <MetricCard label="Recognized paid orders" value={String(report.recognizedPaidOrderCount)} detail="Order-created Eastern date basis" />
            <MetricCard label="Average recognized order" value={averageOrder} detail="Unavailable when no recognized orders exist" />
            <MetricCard label="Scheduled service orders" value={String(report.scheduledServiceOrderCount)} detail="Non-cancelled · serviceDate basis" />
            <MetricCard label="Repeat linked-customer rate" value={repeatRate} detail={`${report.repeatLinkedCustomerCount} repeat of ${report.linkedCustomerCount} exact linked IDs`} />
          </section>
          <Panel className="frontier-reports__section">
            <h3>Payment exceptions</h3>
            <div className="frontier-reports__exception-grid">
              {report.paymentExceptions.map((exception) => (
                <article key={exception.key}>
                  <span>{exception.label}</span>
                  <strong>{exception.count}</strong>
                  <small>{formatCurrency(exception.totalCents)} order total</small>
                </article>
              ))}
            </div>
          </Panel>
          <Panel className="frontier-reports__section">
            <h3>Coverage summary</h3>
            <dl className="frontier-reports__coverage">
              <div><dt>Snapshot generated</dt><dd>{formatDateTime(report.generatedAt)}</dd></div>
              <div><dt>Loaded orders</dt><dd>{report.coverage.loadedOrderCount}</dd></div>
              <div><dt>Loaded customers</dt><dd>{report.coverage.loadedCustomerCount}</dd></div>
              <div><dt>Selected financial orders</dt><dd>{report.coverage.selectedFinancialOrderCount}</dd></div>
              <div><dt>Recognized paid orders</dt><dd>{report.coverage.recognizedPaidOrderCount}</dd></div>
              <div><dt>Scheduled service orders</dt><dd>{report.coverage.scheduledServiceOrderCount}</dd></div>
              <div><dt>Unlinked recognized orders</dt><dd>{report.coverage.unlinkedRecognizedOrderCount}</dd></div>
              <div><dt>Missing loaded customer references</dt><dd>{report.coverage.missingLoadedCustomerReferenceCount}</dd></div>
              <div><dt>Missing or invalid serviceDate</dt><dd>{report.coverage.missingServiceDateCount}</dd></div>
              <div><dt>Invalid order-created timestamps</dt><dd>{report.coverage.invalidCreatedAtCount}</dd></div>
              <div><dt>Observed loaded created-date bounds</dt><dd>{report.range.observedStartDate && report.range.observedEndDate ? `${report.range.observedStartDate} through ${report.range.observedEndDate}` : "Unavailable"}</dd></div>
            </dl>
          </Panel>
        </div>
      ) : null}

      {mode === "sales" ? (
        <div className="frontier-reports__mode">
          <Notice>Sales metrics and item rankings use the order-created Eastern business date. They do not represent settlement, deposits, or accounting revenue.</Notice>
          <div className="frontier-reports__chart-grid">
            <MoneySeries rows={report.dailyRecognizedRevenue} title="Daily recognized revenue" />
            <CountSeries rows={report.dailyRecognizedOrders} title="Daily recognized paid orders" valueLabel="Recognized paid orders" />
          </div>
          <Panel className="frontier-reports__section">
            <h3>Payment-exception breakdown</h3>
            <div className="frontier-reports__table-wrap">
              <table>
                <caption>Orders excluded from recognized revenue or flagged for integrity review</caption>
                <thead><tr><th scope="col">Classification</th><th scope="col">Orders</th><th scope="col">Order total</th></tr></thead>
                <tbody>{report.paymentExceptions.map((row) => <tr key={row.key}><th scope="row">{row.label}</th><td>{row.count}</td><td>{formatCurrency(row.totalCents)}</td></tr>)}</tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : null}

      {mode === "operations" ? (
        <div className="frontier-reports__mode">
          <Notice>Operations metrics use valid order.serviceDate values. Orders without a valid serviceDate are excluded and counted in coverage.</Notice>
          <section aria-label="Operations metrics" className="frontier-reports__metrics">
            <MetricCard label="Scheduled service orders" value={String(report.scheduledServiceOrderCount)} detail="Non-cancelled selected service-date cohort" />
            <MetricCard label="Pickup" value={String(report.pickupCount)} detail="Selected service-date cohort" />
            <MetricCard label="Delivery" value={String(report.deliveryCount)} detail="Selected service-date cohort" />
            <MetricCard label="Missing serviceDate" value={String(report.coverage.missingServiceDateCount)} detail="Loaded orders outside service-date metrics" />
          </section>
          <CountSeries rows={report.dailyScheduledServiceOrders} title="Daily scheduled service orders" valueLabel="Scheduled non-cancelled orders" />
          <Panel className="frontier-reports__section">
            <h3>Authoritative lifecycle timing</h3>
            <p className="frontier-reports__section-copy">Only createdAt, prepStartedAt, readyAt, and pickedUpAt are used. updatedAt is never a timing proxy.</p>
            <div className="frontier-reports__table-wrap">
              <table>
                <caption>Lifecycle duration coverage for the selected service-date cohort</caption>
                <thead><tr><th scope="col">Duration</th><th scope="col">Average</th><th scope="col">Samples</th><th scope="col">Missing</th><th scope="col">Invalid</th></tr></thead>
                <tbody>{report.lifecycle.map((metric) => <tr key={metric.key}><th scope="row">{metric.label}</th><td>{formatDuration(metric.averageMinutes)}</td><td>{metric.sampleCount}</td><td>{metric.missingCount}</td><td>{metric.invalidCount}</td></tr>)}</tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : null}

      {mode === "customers-items" ? (
        <div className="frontier-reports__mode">
          <Notice>Customer association uses exact nonblank customerId values only. Names, emails, stored order totals, and lifetime-value fields are not used.</Notice>
          <section aria-label="Customer metrics" className="frontier-reports__metrics">
            <MetricCard label="Exact linked customers" value={String(report.linkedCustomerCount)} detail="At least one recognized paid order" />
            <MetricCard label="Repeat linked customers" value={String(report.repeatLinkedCustomerCount)} detail="At least two recognized paid orders" />
            <MetricCard label="Repeat rate" value={repeatRate} detail="Unlinked orders excluded" />
            <MetricCard label="Unlinked recognized orders" value={String(report.unlinkedRecognizedOrderCount)} detail="No nonblank customerId" />
            <MetricCard label="Missing customer references" value={String(report.missingLoadedCustomerReferenceCount)} detail="Exact IDs absent from loaded customers" />
          </section>
          <Panel className="frontier-reports__section">
            <h3>Item ranking</h3>
            <p className="frontier-reports__section-copy">Recognized paid orders only. Different item IDs remain separate even when names match; label-only items remain explicitly unlinked.</p>
            {report.itemRanking.length ? (
              <div className="frontier-reports__table-wrap">
                <table>
                  <caption>Items ranked by quantity, recognized-order count, display name, and identity key</caption>
                  <thead><tr><th scope="col">Item</th><th scope="col">Identity</th><th scope="col">Source</th><th scope="col">Quantity</th><th scope="col">Recognized orders</th></tr></thead>
                  <tbody>{report.itemRanking.map((row) => <tr key={row.identityKey}><th scope="row">{row.displayName}</th><td><code>{row.identityKey}</code></td><td>{row.identitySource}</td><td>{row.quantity}</td><td>{row.recognizedOrderCount}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="frontier-reports__empty">No recognized paid line items are available for this range.</p>}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
