"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { formatCurrency, initials, statusTone } from "@/lib/dashboard/format";
import {
  ACTIVITY_SCOPE,
  buildCustomerDirectoryRows,
  deriveCustomerZones,
  filterActivityWorkspace,
  filterCustomerDirectory,
  getActivityStatusOptions,
  getCustomerSummaryCounts,
  getWorkspaceCompleteness,
  enrichActivityEvents,
  sortSubscribers,
  type CustomerDirectoryRow,
  type CustomerSort,
  type SubscriberAvailability,
} from "@/lib/dashboard/customer-activity-workspace";
import type {
  Customer,
  DashboardSnapshot,
  EmailUpdate,
  OrderStatus,
  OrderStatusEvent,
} from "@/types/domain";

type WorkspaceMode = "directory" | "subscribers" | "activity";

const MODE_LABELS: Record<WorkspaceMode, string> = {
  directory: "Directory",
  subscribers: "Subscribers",
  activity: "Activity",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(parsed);
}

function formatDateTime(value: string) {
  if (!Number.isFinite(new Date(value).getTime())) return "Timestamp unavailable";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function sourceNotice(source: SubscriberAvailability, loadedLabel: string) {
  return source.status === "unavailable"
    ? "Unavailable — this optional source could not be loaded."
    : loadedLabel;
}

function StatusPill({ children }: { children: string }) {
  return <span className={`frontier-customers__status frontier-customers__status--${statusTone(children) || "neutral"}`}>{children}</span>;
}

function SummaryCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="frontier-customers__summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function CustomerDetail({
  row,
  emailUpdates,
  subscriberAvailability,
  onClose,
}: {
  row: CustomerDirectoryRow;
  emailUpdates: EmailUpdate[];
  subscriberAvailability: SubscriberAvailability;
  onClose: () => void;
}) {
  const { customer, directOrders, possibleEmailMatches, storedSummaryMismatch } = row;
  const subscriber = customer.email
    ? emailUpdates.find((update) => update.email.trim().toLowerCase() === customer.email?.trim().toLowerCase())
    : null;

  return (
    <Sheet onClose={onClose} title={`${customer.name} details`}>
      <div className="frontier-customers__detail-stack">
        <section aria-labelledby="customer-identity-heading" className="frontier-customers__detail-section">
          <h3 id="customer-identity-heading">Identity</h3>
          <dl className="frontier-customers__detail-grid">
            <div><dt>Name</dt><dd>{customer.name}</dd></div>
            <div><dt>Email</dt><dd>{customer.email || "Not provided"}</dd></div>
            <div><dt>Zone</dt><dd>{customer.zone || "Not provided"}</dd></div>
            <div><dt>Loyalty tier</dt><dd><StatusPill>{customer.loyaltyTier}</StatusPill></dd></div>
          </dl>
        </section>

        <section aria-labelledby="stored-summary-heading" className="frontier-customers__detail-section">
          <h3 id="stored-summary-heading">Stored customer summary</h3>
          <p className="frontier-customers__detail-explainer">These values come from the stored customer record. They are not recalculated here.</p>
          <dl className="frontier-customers__detail-grid">
            <div><dt>Stored total orders</dt><dd>{customer.totalOrders}</dd></div>
            <div><dt>Stored lifetime value</dt><dd>{formatCurrency(customer.lifetimeValueCents)}</dd></div>
          </dl>
          {storedSummaryMismatch.totalOrders || storedSummaryMismatch.lifetimeValueCents ? (
            <p className="frontier-customers__notice frontier-customers__notice--warning">
              Stored summary differs from the directly linked orders currently supplied. No stored value was overwritten.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="linked-orders-heading" className="frontier-customers__detail-section">
          <div className="frontier-customers__section-heading">
            <div><h3 id="linked-orders-heading">Directly linked order history</h3><p>Exact customer ID matches only.</p></div>
            <strong>{directOrders.length}</strong>
          </div>
          {directOrders.length ? (
            <div className="frontier-customers__detail-orders">
              {directOrders.map((order) => (
                <article className="frontier-customers__detail-order" key={order.id}>
                  <div><strong>{order.orderNumber}</strong><StatusPill>{order.status}</StatusPill></div>
                  <dl>
                    <div><dt>Service date</dt><dd>{order.serviceDate || "Date unavailable"}</dd></div>
                    <div><dt>Total</dt><dd>{formatCurrency(order.totalCents)}</dd></div>
                    <div><dt>Created</dt><dd>{formatDate(order.createdAt)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : <p className="frontier-customers__empty-copy">No directly linked orders are present in this snapshot.</p>}
        </section>

        <section aria-labelledby="possible-matches-heading" className="frontier-customers__detail-section">
          <div className="frontier-customers__section-heading">
            <div><h3 id="possible-matches-heading">Possible unlinked email matches</h3><p>Informational only; these orders are not automatically linked.</p></div>
            <strong>{possibleEmailMatches.length}</strong>
          </div>
          {possibleEmailMatches.length ? (
            <ul className="frontier-customers__plain-list">
              {possibleEmailMatches.map((order) => <li key={order.id}>{order.orderNumber} · {formatCurrency(order.totalCents)}</li>)}
            </ul>
          ) : <p className="frontier-customers__empty-copy">No possible email matches in this snapshot.</p>}
        </section>

        <section aria-labelledby="subscriber-context-heading" className="frontier-customers__detail-section">
          <h3 id="subscriber-context-heading">Subscriber context</h3>
          {subscriberAvailability.status === "unavailable" ? <p className="frontier-customers__notice frontier-customers__notice--warning">Subscriber context is unavailable because the optional subscriber source did not load.</p> : subscriber ? (
            <dl className="frontier-customers__detail-grid">
              <div><dt>Status</dt><dd><StatusPill>{subscriber.status}</StatusPill></dd></div>
              <div><dt>Source</dt><dd>{subscriber.source}</dd></div>
              <div><dt>Signup location</dt><dd>{subscriber.signupLocation || "Not recorded"}</dd></div>
              <div><dt>Created</dt><dd>{formatDate(subscriber.createdAt)}</dd></div>
              <div><dt>Last requested</dt><dd>{formatDate(subscriber.lastRequestedAt)}</dd></div>
            </dl>
          ) : <p className="frontier-customers__empty-copy">No independently loaded subscriber record exactly matches this email.</p>}
        </section>

        <section aria-labelledby="internal-notes-heading" className="frontier-customers__detail-section">
          <h3 id="internal-notes-heading">Private internal notes</h3>
          <p className="frontier-customers__notes">{customer.notes || "No private internal notes recorded."}</p>
        </section>
      </div>
    </Sheet>
  );
}

function DirectoryMode({
  rows,
  customers,
  onOpen,
}: {
  rows: CustomerDirectoryRow[];
  customers: Customer[];
  onOpen: (row: CustomerDirectoryRow, button: HTMLButtonElement) => void;
}) {
  const [search, setSearch] = useState("");
  const [loyaltyTier, setLoyaltyTier] = useState<Customer["loyaltyTier"] | "all">("all");
  const [zone, setZone] = useState("all");
  const [sort, setSort] = useState<CustomerSort>("loyalty");
  const zones = useMemo(() => deriveCustomerZones(customers), [customers]);
  const filteredRows = useMemo(
    () => filterCustomerDirectory(rows, { search, loyaltyTier, zone, sort }),
    [loyaltyTier, rows, search, sort, zone],
  );
  const counts = useMemo(() => getCustomerSummaryCounts(rows), [rows]);

  return (
    <div className="frontier-customers__mode-content">
      <div className="frontier-customers__summary-grid">
        <SummaryCard detail="Stored customer rows" label="Stored customers" value={counts.storedCustomers} />
        <SummaryCard detail="Stored loyalty classification" label="VIP records" value={counts.vipRecords} />
        <SummaryCard detail="Exact customer ID joins" label="Directly linked orders" value={counts.directlyLinkedOrders} />
        <SummaryCard detail="Not included in linked totals" label="Unlinked email matches" value={counts.unlinkedEmailMatchCandidates} />
      </div>

      <div className="frontier-customers__toolbar">
        <label className="frontier-customers__search">
          <span>Search customers</span>
          <input aria-label="Search customers by name, email, zone, tier, or internal notes" onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, zone, notes…" value={search} />
        </label>
        <label className="frontier-customers__control"><span>Loyalty tier</span><select aria-label="Filter customers by loyalty tier" onChange={(event) => setLoyaltyTier(event.target.value as Customer["loyaltyTier"] | "all")} value={loyaltyTier}><option value="all">All tiers</option><option value="VIP">VIP</option><option value="High">High</option><option value="Rising">Rising</option><option value="Early">Early</option></select></label>
        <label className="frontier-customers__control"><span>Zone</span><select aria-label="Filter customers by zone" onChange={(event) => setZone(event.target.value)} value={zone}><option value="all">All zones</option>{zones.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="frontier-customers__control"><span>Sort</span><select aria-label="Sort customer directory" onChange={(event) => setSort(event.target.value as CustomerSort)} value={sort}><option value="loyalty">Loyalty priority</option><option value="lifetime">Lifetime value</option><option value="name">Customer name</option><option value="direct-orders">Directly linked orders</option></select></label>
      </div>
      <p aria-live="polite" className="frontier-customers__result-count">Showing {filteredRows.length} of {rows.length} stored customers</p>

      {filteredRows.length ? (
        <div className="frontier-customers__directory-list">
          {filteredRows.map((row) => (
            <article className="frontier-customers__directory-row" key={row.customer.id}>
              <div className="frontier-customers__avatar" aria-hidden="true">{initials(row.customer.name)}</div>
              <div className="frontier-customers__directory-main">
                <div className="frontier-customers__directory-title"><h3>{row.customer.name}</h3><StatusPill>{row.customer.loyaltyTier}</StatusPill></div>
                <p>{row.customer.email || "Email not provided"} · {row.customer.zone || "Zone unavailable"}</p>
                <p className="frontier-customers__directory-meta">{row.customer.totalOrders} stored orders · {formatCurrency(row.customer.lifetimeValueCents)} stored value · {row.directOrders.length} directly linked</p>
                {row.possibleEmailMatches.length ? <p className="frontier-customers__flag">{row.possibleEmailMatches.length} possible unlinked email match{row.possibleEmailMatches.length === 1 ? "" : "es"}</p> : null}
                {row.storedSummaryMismatch.totalOrders || row.storedSummaryMismatch.lifetimeValueCents ? <p className="frontier-customers__flag">Stored summary needs reconciliation</p> : null}
              </div>
              <button className="frontier-customers__detail-button" onClick={(event) => onOpen(row, event.currentTarget)} type="button">View details</button>
            </article>
          ))}
        </div>
      ) : <div className="frontier-customers__empty"><h3>No customer matches</h3><p>{search || loyaltyTier !== "all" || zone !== "all" ? "Adjust the search or filters to see stored customer records." : "No stored customer records are available."}</p></div>}
    </div>
  );
}

function SubscribersMode({ updates, availability }: { updates: EmailUpdate[]; availability: SubscriberAvailability }) {
  const sorted = useMemo(() => sortSubscribers(updates), [updates]);
  return (
    <div className="frontier-customers__mode-content">
      <div className="frontier-customers__availability frontier-customers__availability--subscribers" data-state={availability.status}>
        <strong>{availability.status === "unavailable" ? "Subscriber data unavailable" : "Subscriber data loaded"}</strong>
        <span>{sourceNotice(availability, `${updates.length} subscriber record${updates.length === 1 ? "" : "s"} supplied`)}</span>
      </div>
      {availability.status === "unavailable" ? <div className="frontier-customers__empty"><h3>Subscribers could not be loaded</h3><p>This state is separate from a valid empty subscriber list.</p></div> : sorted.length ? (
        <div className="frontier-customers__subscriber-list">
          {sorted.map((update) => <article className="frontier-customers__subscriber-row" key={update.id}>
            <div><h3>{update.email}</h3><p>{update.source} · {update.signupLocation || "Signup location unavailable"}</p></div>
            <StatusPill>{update.status}</StatusPill>
            <dl><div><dt>Created</dt><dd>{formatDate(update.createdAt)}</dd></div><div><dt>Last requested</dt><dd>{formatDate(update.lastRequestedAt)}</dd></div></dl>
            {update.notes ? <p className="frontier-customers__contained-note">Note: {update.notes}</p> : null}
          </article>)}
        </div>
      ) : <div className="frontier-customers__empty"><h3>No subscriber records</h3><p>The subscriber source loaded successfully with zero rows.</p></div>}
    </div>
  );
}

function ActivityMode({ events, customers, orders, availability }: { events: OrderStatusEvent[]; customers: Customer[]; orders: DashboardSnapshot["orders"]; availability: SubscriberAvailability }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const activity = useMemo(() => enrichActivityEvents(events, orders, customers), [customers, events, orders]);
  const filtered = useMemo(() => filterActivityWorkspace(activity, { search, status }), [activity, search, status]);
  const statusOptions = getActivityStatusOptions();
  return (
    <div className="frontier-customers__mode-content">
      <div className="frontier-customers__scope-notice"><strong>Scope: recorded order-status transitions only</strong><span>Customer notes, subscriber changes, inventory updates, menu changes, and communications are not included.</span></div>
      <div className="frontier-customers__availability" data-state={availability.status}><strong>{availability.status === "unavailable" ? "Activity data unavailable" : "Activity data loaded"}</strong><span>{sourceNotice(availability, `${events.length} recorded event${events.length === 1 ? "" : "s"} supplied`)}</span></div>
      <div className="frontier-customers__toolbar frontier-customers__toolbar--activity">
        <label className="frontier-customers__search"><span>Search activity</span><input aria-label="Search activity by order, customer, or status transition" onChange={(event) => setSearch(event.target.value)} placeholder="Order, customer, from, to…" value={search} /></label>
        <label className="frontier-customers__control"><span>To status</span><select aria-label="Filter activity by destination status" onChange={(event) => setStatus(event.target.value as OrderStatus | "all")} value={status}><option value="all">All statuses</option>{statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </div>
      <p aria-live="polite" className="frontier-customers__result-count">Showing {filtered.length} of {activity.length} recorded events</p>
      {availability.status === "unavailable" ? <div className="frontier-customers__empty"><h3>Activity could not be loaded</h3><p>No events are fabricated from order timestamps.</p></div> : filtered.length ? <div className="frontier-customers__activity-list">{filtered.map((item) => <article className="frontier-customers__activity-row" key={item.event.id}>
        <div className="frontier-customers__activity-marker" aria-hidden="true" />
        <div className="frontier-customers__activity-main"><div className="frontier-customers__directory-title"><h3>{item.order?.orderNumber || "Order unavailable"}</h3><StatusPill>{item.event.toStatus}</StatusPill></div><p>{item.customer ? item.customer.name : item.order?.customerId ? "Customer unavailable" : "Customer not directly linked"}</p><p className="frontier-customers__activity-transition">{item.event.fromStatus} <span aria-hidden="true">→</span> {item.event.toStatus}</p><p className="frontier-customers__directory-meta">{formatDateTime(item.event.changedAt)} · {item.actorState === "recorded" ? "Recorded admin actor" : "Actor unavailable"} · Order status audit</p></div>
      </article>)}</div> : <div className="frontier-customers__empty"><h3>No activity matches</h3><p>{search || status !== "all" ? "Adjust the search or status filter." : "The activity source loaded successfully with zero recorded order-status events."}</p></div>}
    </div>
  );
}

export function CustomersView({
  customers,
  emailUpdates,
  activity,
  activityScope,
  optionalSources,
  orders = [],
}: {
  customers: Customer[];
  emailUpdates: EmailUpdate[];
  activity: OrderStatusEvent[];
  activityScope: DashboardSnapshot["activityScope"];
  optionalSources: DashboardSnapshot["optionalSources"];
  orders?: DashboardSnapshot["orders"];
}) {
  const [mode, setMode] = useState<WorkspaceMode>("directory");
  const [selectedRow, setSelectedRow] = useState<CustomerDirectoryRow | null>(null);
  const detailButtons = useRef(new Map<string, HTMLButtonElement>());
  const rows = useMemo(() => buildCustomerDirectoryRows(customers, orders), [customers, orders]);
  const completeness = getWorkspaceCompleteness({ customerCount: customers.length, subscriberAvailability: optionalSources.subscribers, activityAvailability: optionalSources.activity, activityCount: activity.length });
  const selectedActivityScope = activityScope || ACTIVITY_SCOPE;

  useEffect(() => {
    if (!selectedRow) return;
    const focusTimer = window.setTimeout(() => document.querySelector<HTMLButtonElement>(".sheet-close")?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [selectedRow]);

  function closeDetails() {
    const id = selectedRow?.customer.id;
    setSelectedRow(null);
    if (id) window.requestAnimationFrame(() => detailButtons.current.get(id)?.focus());
  }

  return (
    <section aria-labelledby="customers-activity-heading" className="frontier-customers">
      <div className="frontier-customers__workspace-content" inert={selectedRow ? true : undefined}>
        <div className="frontier-customers__intro"><div><p className="frontier-customers__eyebrow">Customer intelligence</p><h2 id="customers-activity-heading">Customers &amp; Activity</h2><p>Read-only customer context and recorded lifecycle evidence for the current dashboard snapshot.</p></div><span className={`frontier-customers__completeness frontier-customers__completeness--${completeness}`}>{completeness === "degraded" ? "Degraded source coverage" : completeness === "empty" ? "No records" : "Snapshot coverage"}</span></div>
        <div aria-label="Customers and activity modes" className="frontier-customers__mode-switcher">
          {(Object.keys(MODE_LABELS) as WorkspaceMode[]).map((item) => <button aria-pressed={mode === item} className={mode === item ? "is-active" : ""} key={item} onClick={() => setMode(item)} type="button">{MODE_LABELS[item]}</button>)}
        </div>
        {mode === "directory" ? <DirectoryMode customers={customers} onOpen={(row, button) => { detailButtons.current.set(row.customer.id, button); setSelectedRow(row); }} rows={rows} /> : null}
        {mode === "subscribers" ? <SubscribersMode availability={optionalSources.subscribers} updates={emailUpdates} /> : null}
        {mode === "activity" ? <ActivityMode availability={optionalSources.activity} customers={customers} events={activity} orders={orders} /> : null}
        <span className="sr-only">Activity scope: {selectedActivityScope}</span>
      </div>
      {selectedRow ? <CustomerDetail emailUpdates={emailUpdates} onClose={closeDetails} row={selectedRow} subscriberAvailability={optionalSources.subscribers} /> : null}
    </section>
  );
}
