import assert from "node:assert/strict";
import test from "node:test";

import {
  LOADED_SNAPSHOT_DISCLOSURE,
  RECOGNIZED_REVENUE_DISCLOSURE,
  buildDailyRecognizedSeries,
  buildDailyServiceSeries,
  buildItemRanking,
  buildLifecycleMetrics,
  buildLinkedCustomerMetrics,
  buildReportsWorkspace,
  classifyPaymentExceptions,
  enumerateDateKeys,
  getEasternDateKey,
  resolveReportRange,
  shiftDateKey,
} from "../src/lib/dashboard/reports-workspace.ts";

function order(overrides = {}) {
  return {
    id: "order-1",
    orderNumber: "MG-TEST",
    customerId: "customer-1",
    customerName: "Amina Noor",
    customerEmail: "amina@example.com",
    customerZone: "Fairfax",
    status: "Picked Up",
    serviceDate: "2026-03-17",
    legacyDropDay: null,
    fulfillmentMethod: "pickup",
    serviceWindow: "5:00 PM",
    totalCents: 1000,
    customRequest: null,
    operatorNote: null,
    paymentProvider: "Stripe",
    paymentStatus: "paid",
    createdAt: "2026-03-17T14:00:00.000Z",
    updatedAt: "2030-01-01T00:00:00.000Z",
    prepStartedAt: "2026-03-17T14:10:00.000Z",
    readyAt: "2026-03-17T14:40:00.000Z",
    pickedUpAt: "2026-03-17T15:00:00.000Z",
    cancelledAt: null,
    items: [],
    ...overrides,
  };
}

function customer(overrides = {}) {
  return {
    id: "customer-1",
    name: "Amina Noor",
    email: "amina@example.com",
    zone: "Fairfax",
    totalOrders: 999,
    lifetimeValueCents: 999999,
    loyaltyTier: "VIP",
    notes: null,
    lastOrderAt: null,
    ...overrides,
  };
}

function workspace(overrides = {}) {
  return buildReportsWorkspace({
    generatedAt: "2026-03-17T21:00:00.000Z",
    orders: [order()],
    customers: [customer()],
    rangeMode: "last-7",
    ...overrides,
  });
}

test("resolves the Eastern anchor from generatedAt", () => {
  assert.equal(getEasternDateKey("2026-03-18T03:59:59.000Z"), "2026-03-17");
  assert.equal(getEasternDateKey("2026-03-18T04:00:00.000Z"), "2026-03-18");
});

test("anchors ranges to generatedAt rather than system time", () => {
  const range = resolveReportRange("2020-01-15T17:00:00.000Z", "last-7", []);
  assert.equal(range.anchorDate, "2020-01-15");
  assert.equal(range.startDate, "2020-01-09");
  assert.equal(range.endDate, "2020-01-15");
});

test("iterates calendar date keys across spring-forward", () => {
  assert.deepEqual(enumerateDateKeys("2026-03-06", "2026-03-10"), [
    "2026-03-06",
    "2026-03-07",
    "2026-03-08",
    "2026-03-09",
    "2026-03-10",
  ]);
});

test("iterates calendar date keys across fall-back", () => {
  assert.deepEqual(enumerateDateKeys("2025-10-31", "2025-11-03"), [
    "2025-10-31",
    "2025-11-01",
    "2025-11-02",
    "2025-11-03",
  ]);
});

test("builds deterministic seven-date range", () => {
  const range = resolveReportRange("2026-03-17T21:00:00.000Z", "last-7", []);
  assert.equal(range.dateKeys.length, 7);
  assert.equal(range.dateKeys[0], "2026-03-11");
  assert.equal(range.dateKeys.at(-1), "2026-03-17");
  assert.equal(range.visibleLabel, "2026-03-11 through 2026-03-17");
  assert.equal(range.bounded, true);
});

test("builds deterministic thirty-date range", () => {
  const range = resolveReportRange("2026-03-17T21:00:00.000Z", "last-30", []);
  assert.equal(range.dateKeys.length, 30);
  assert.equal(range.startDate, "2026-02-16");
  assert.equal(range.endDate, "2026-03-17");
});

test("all-loaded mode reports observed valid created-date bounds", () => {
  const range = resolveReportRange("2026-03-17T21:00:00.000Z", "all-loaded", [
    order({ createdAt: "bad" }),
    order({ createdAt: "2026-03-10T23:00:00.000Z" }),
    order({ createdAt: "2026-03-15T01:00:00.000Z" }),
  ]);
  assert.equal(range.startDate, "2026-03-10");
  assert.equal(range.endDate, "2026-03-14");
  assert.equal(range.visibleLabel, "All loaded data · observed 2026-03-10 through 2026-03-14");
  assert.equal(range.bounded, false);
});

test("invalid generatedAt remains unavailable and never falls back", () => {
  const range = resolveReportRange("not-a-date", "last-7", []);
  assert.equal(range.anchorDate, null);
  assert.equal(range.startDate, null);
  assert.equal(range.endDate, null);
  assert.deepEqual(range.dateKeys, []);
  assert.equal(range.visibleLabel, "Date range unavailable");
});

test("created-date filtering uses Eastern dates", () => {
  const model = workspace({
    generatedAt: "2026-03-17T21:00:00.000Z",
    orders: [
      order({ id: "inside", createdAt: "2026-03-11T04:30:00.000Z" }),
      order({ id: "outside", createdAt: "2026-03-11T03:30:00.000Z" }),
    ],
  });
  assert.equal(model.recognizedPaidOrderCount, 1);
  assert.equal(model.recognizedRevenueCents, 1000);
});

test("service-date filtering is independent from created date", () => {
  const model = workspace({
    orders: [
      order({ id: "inside", createdAt: "2020-01-01T00:00:00.000Z", serviceDate: "2026-03-17" }),
      order({ id: "outside", createdAt: "2026-03-17T14:00:00.000Z", serviceDate: "2026-03-01" }),
    ],
  });
  assert.equal(model.recognizedPaidOrderCount, 1);
  assert.equal(model.scheduledServiceOrderCount, 1);
});

for (const paymentStatus of ["paid", "captured", "succeeded"]) {
  test(`recognizes ${paymentStatus} as paid`, () => {
    assert.equal(workspace({ orders: [order({ paymentStatus })] }).recognizedPaidOrderCount, 1);
  });
}

for (const paymentStatus of ["pending", "unpaid", "failed", "refunded", "unsupported"] ) {
  test(`excludes ${paymentStatus} from recognized revenue`, () => {
    const model = workspace({ orders: [order({ paymentStatus })] });
    assert.equal(model.recognizedPaidOrderCount, 0);
    assert.equal(model.recognizedRevenueCents, 0);
  });
}

test("excludes cancelled recognized-paid orders", () => {
  const model = workspace({ orders: [order({ status: "Cancelled", paymentStatus: "paid" })] });
  assert.equal(model.recognizedPaidOrderCount, 0);
  assert.equal(model.paymentExceptions.at(-1).count, 1);
});

test("calculates recognized revenue, count, and average", () => {
  const model = workspace({
    orders: [order({ id: "a", totalCents: 1000 }), order({ id: "b", totalCents: 2000 })],
  });
  assert.equal(model.recognizedRevenueCents, 3000);
  assert.equal(model.recognizedPaidOrderCount, 2);
  assert.equal(model.averageRecognizedOrderCents, 1500);
});

test("returns null average when no recognized orders exist", () => {
  assert.equal(workspace({ orders: [order({ paymentStatus: "pending" })] }).averageRecognizedOrderCents, null);
});

test("classifies payment exceptions with counts and totals", () => {
  const exceptions = classifyPaymentExceptions([
    order({ id: "p", paymentStatus: "requires action", totalCents: 100 }),
    order({ id: "f", paymentStatus: "declined", totalCents: 200 }),
    order({ id: "r", paymentStatus: "partial-refund", totalCents: 300 }),
    order({ id: "u", paymentStatus: "", totalCents: 400 }),
    order({ id: "c", status: "Cancelled", paymentStatus: "CAPTURED", totalCents: 500 }),
  ]);
  assert.deepEqual(exceptions.map(({ count, totalCents }) => ({ count, totalCents })), [
    { count: 1, totalCents: 100 },
    { count: 1, totalCents: 200 },
    { count: 1, totalCents: 300 },
    { count: 1, totalCents: 400 },
    { count: 1, totalCents: 500 },
  ]);
});

test("repeat customers use exact nonblank customer IDs", () => {
  const metrics = buildLinkedCustomerMetrics([
    order({ id: "1", customerId: "customer-1" }),
    order({ id: "2", customerId: "customer-1" }),
    order({ id: "3", customerId: "customer-2" }),
  ], [customer(), customer({ id: "customer-2" })]);
  assert.equal(metrics.linkedCustomerCount, 2);
  assert.equal(metrics.repeatLinkedCustomerCount, 1);
  assert.equal(metrics.repeatRatePercent, 50);
});

test("unlinked orders stay outside repeat numerator and denominator", () => {
  const metrics = buildLinkedCustomerMetrics([
    order({ id: "1", customerId: null }),
    order({ id: "2", customerId: "   " }),
  ], [customer()]);
  assert.equal(metrics.linkedCustomerCount, 0);
  assert.equal(metrics.repeatLinkedCustomerCount, 0);
  assert.equal(metrics.repeatRatePercent, null);
  assert.equal(metrics.unlinkedRecognizedOrderCount, 2);
});

test("reports missing loaded customer references by exact identifier", () => {
  const metrics = buildLinkedCustomerMetrics([
    order({ id: "1", customerId: "missing" }),
    order({ id: "2", customerId: "missing" }),
  ], [customer()]);
  assert.equal(metrics.linkedCustomerCount, 1);
  assert.equal(metrics.missingLoadedCustomerReferenceCount, 1);
});

test("does not associate customers by matching name", () => {
  const model = workspace({
    orders: [order({ customerId: null, customerName: "Amina Noor" })],
    customers: [customer({ totalOrders: 0 })],
  });
  assert.equal(model.linkedCustomerCount, 0);
  assert.equal(model.unlinkedRecognizedOrderCount, 1);
});

test("does not associate customers by matching email", () => {
  const model = workspace({
    orders: [order({ customerId: null, customerEmail: "amina@example.com" })],
    customers: [customer()],
  });
  assert.equal(model.linkedCustomerCount, 0);
});

test("stored customer totals do not affect repeat logic", () => {
  const model = workspace({
    orders: [order()],
    customers: [customer({ totalOrders: 1000, lifetimeValueCents: 99999999 })],
  });
  assert.equal(model.repeatLinkedCustomerCount, 0);
});

test("groups ID-backed items by exact ID", () => {
  const ranking = buildItemRanking([
    order({ id: "a", items: [{ id: "1", orderId: "a", menuItemId: "dish", name: "Dish", quantity: 2, notes: null, unitPriceCents: 100 }] }),
    order({ id: "b", items: [{ id: "2", orderId: "b", menuItemId: "dish", name: "Renamed Dish", quantity: 3, notes: null, unitPriceCents: 100 }] }),
  ]);
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].identityKey, "id:dish");
  assert.equal(ranking[0].quantity, 5);
  assert.equal(ranking[0].recognizedOrderCount, 2);
});

test("groups label-only items by normalized label", () => {
  const ranking = buildItemRanking([
    order({ id: "a", items: [{ id: "1", orderId: "a", menuItemId: null, name: "  Green   Chutney ", quantity: 1, notes: null, unitPriceCents: 0 }] }),
    order({ id: "b", items: [{ id: "2", orderId: "b", menuItemId: null, name: "green chutney", quantity: 1, notes: null, unitPriceCents: 0 }] }),
  ]);
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].identityKey, "label:green chutney");
  assert.equal(ranking[0].identitySource, "unlinked label");
});

test("never merges different IDs or ID-backed and label-only items", () => {
  const ranking = buildItemRanking([order({ items: [
    { id: "1", orderId: "order-1", menuItemId: "a", name: "Same", quantity: 1, notes: null, unitPriceCents: 100 },
    { id: "2", orderId: "order-1", menuItemId: "b", name: "Same", quantity: 1, notes: null, unitPriceCents: 100 },
    { id: "3", orderId: "order-1", menuItemId: null, name: "Same", quantity: 1, notes: null, unitPriceCents: 100 },
  ] })]);
  assert.deepEqual(ranking.map((row) => row.identityKey).sort(), ["id:a", "id:b", "label:same"]);
});

test("item ranking uses deterministic tie-breakers", () => {
  const ranking = buildItemRanking([order({ items: [
    { id: "1", orderId: "order-1", menuItemId: "z", name: "Beta", quantity: 2, notes: null, unitPriceCents: 1 },
    { id: "2", orderId: "order-1", menuItemId: "a", name: "Alpha", quantity: 2, notes: null, unitPriceCents: 1 },
  ] })]);
  assert.deepEqual(ranking.map((row) => row.identityKey), ["id:a", "id:z"]);
});

test("malformed quantities are ignored rather than defaulted", () => {
  const ranking = buildItemRanking([order({ items: [
    { id: "1", orderId: "order-1", menuItemId: "bad", name: "Bad", quantity: Number.NaN, notes: null, unitPriceCents: 1 },
    { id: "2", orderId: "order-1", menuItemId: "zero", name: "Zero", quantity: 0, notes: null, unitPriceCents: 1 },
  ] })]);
  assert.deepEqual(ranking, []);
});

test("daily revenue and recognized-order series include zero-value bounded dates", () => {
  const range = resolveReportRange("2026-03-17T21:00:00.000Z", "last-7", []);
  const series = buildDailyRecognizedSeries([order()], range);
  assert.equal(series.revenue.length, 7);
  assert.equal(series.orders.length, 7);
  assert.deepEqual(series.revenue.at(-1), { dateKey: "2026-03-17", valueCents: 1000 });
  assert.deepEqual(series.orders[0], { dateKey: "2026-03-11", count: 0 });
});

test("daily service series uses serviceDate", () => {
  const range = resolveReportRange("2026-03-17T21:00:00.000Z", "last-7", []);
  const series = buildDailyServiceSeries([
    order({ createdAt: "2020-01-01T00:00:00.000Z", serviceDate: "2026-03-12" }),
  ], range);
  assert.equal(series.find((row) => row.dateKey === "2026-03-12")?.count, 1);
});

test("calculates all four authoritative lifecycle durations", () => {
  const metrics = buildLifecycleMetrics([order()]);
  assert.deepEqual(metrics.map(({ averageMinutes, sampleCount }) => ({ averageMinutes, sampleCount })), [
    { averageMinutes: 10, sampleCount: 1 },
    { averageMinutes: 30, sampleCount: 1 },
    { averageMinutes: 20, sampleCount: 1 },
    { averageMinutes: 60, sampleCount: 1 },
  ]);
});

test("counts missing lifecycle endpoints", () => {
  const metric = buildLifecycleMetrics([order({ prepStartedAt: null })])[0];
  assert.equal(metric.sampleCount, 0);
  assert.equal(metric.missingCount, 1);
  assert.equal(metric.invalidCount, 0);
});

test("counts malformed lifecycle timestamps as invalid", () => {
  const metric = buildLifecycleMetrics([order({ prepStartedAt: "bad" })])[0];
  assert.equal(metric.invalidCount, 1);
});

test("counts reversed lifecycle timestamps as invalid", () => {
  const metric = buildLifecycleMetrics([order({ prepStartedAt: "2026-03-17T13:00:00.000Z" })])[0];
  assert.equal(metric.invalidCount, 1);
});

test("allows equal lifecycle timestamps as zero minutes", () => {
  const metric = buildLifecycleMetrics([order({ prepStartedAt: "2026-03-17T14:00:00.000Z" })])[0];
  assert.equal(metric.averageMinutes, 0);
  assert.equal(metric.sampleCount, 1);
});

test("never uses updatedAt for lifecycle timing", () => {
  const metrics = buildLifecycleMetrics([order({ pickedUpAt: null, updatedAt: "2026-03-17T16:00:00.000Z" })]);
  assert.equal(metrics.find((metric) => metric.key === "created-picked-up")?.sampleCount, 0);
  assert.equal(metrics.find((metric) => metric.key === "created-picked-up")?.missingCount, 1);
});

test("coverage metadata reports loaded and selected populations", () => {
  const model = workspace({
    orders: [order(), order({ id: "missing-service", serviceDate: null, createdAt: "bad" })],
    customers: [customer()],
  });
  assert.equal(model.coverage.loadedOrderCount, 2);
  assert.equal(model.coverage.loadedCustomerCount, 1);
  assert.equal(model.coverage.selectedFinancialOrderCount, 1);
  assert.equal(model.coverage.missingServiceDateCount, 1);
  assert.equal(model.coverage.invalidCreatedAtCount, 1);
});

test("empty snapshots remain truthful", () => {
  const model = workspace({ orders: [], customers: [] });
  assert.equal(model.recognizedRevenueCents, 0);
  assert.equal(model.averageRecognizedOrderCents, null);
  assert.equal(model.repeatRatePercent, null);
  assert.deepEqual(model.itemRanking, []);
  assert.equal(model.lifecycle.every((metric) => metric.sampleCount === 0), true);
});

test("series rows provide complete accessible chart values", () => {
  const model = workspace();
  assert.deepEqual(Object.keys(model.dailyRecognizedRevenue[0]), ["dateKey", "valueCents"]);
  assert.deepEqual(Object.keys(model.dailyRecognizedOrders[0]), ["dateKey", "count"]);
  assert.deepEqual(Object.keys(model.dailyScheduledServiceOrders[0]), ["dateKey", "count"]);
});

test("does not mutate caller arrays", () => {
  const orders = [order({ id: "b" }), order({ id: "a" })];
  const customers = [customer()];
  const beforeOrders = structuredClone(orders);
  const beforeCustomers = structuredClone(customers);
  buildReportsWorkspace({ generatedAt: "2026-03-17T21:00:00.000Z", orders, customers, rangeMode: "all-loaded" });
  assert.deepEqual(orders, beforeOrders);
  assert.deepEqual(customers, beforeCustomers);
});

test("permanent disclosures remain exact", () => {
  assert.equal(RECOGNIZED_REVENUE_DISCLOSURE, "Recognized revenue is associated with the order-created date because an authoritative paid-at timestamp is not available in the loaded model.");
  assert.equal(LOADED_SNAPSHOT_DISCLOSURE, "This report covers the currently loaded dashboard snapshot. The current data loader does not paginate or retrieve source totals, so complete business-history coverage has not been verified.");
});

test("date shifting handles month and year boundaries", () => {
  assert.equal(shiftDateKey("2026-01-01", -1), "2025-12-31");
});
