import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_SCOPE,
  associateCustomerOrders,
  activityMatchesSearch,
  buildCustomerDirectoryRows,
  classifySubscriberStatus,
  enrichActivityEvents,
  filterActivityWorkspace,
  filterCustomerDirectory,
  getCustomerSummaryCounts,
  getStoredSummaryMismatch,
  getWorkspaceCompleteness,
  normalizeCustomerSearch,
  normalizeLoyaltyTier,
  sortActivityEvents,
  sortCustomerDirectory,
  sortSubscribers,
} from "../src/lib/dashboard/customer-activity-workspace.ts";

function customer(overrides = {}) {
  return {
    id: "customer-1",
    name: "Amina Noor",
    email: "amina@example.com",
    zone: "Herndon",
    totalOrders: 2,
    lifetimeValueCents: 4200,
    loyaltyTier: "High",
    notes: "Prefers early pickup",
    lastOrderAt: null,
    ...overrides,
  };
}

function order(overrides = {}) {
  return {
    id: "order-1",
    orderNumber: "MG-2001",
    customerId: "customer-1",
    customerName: "Amina Noor",
    customerEmail: "amina@example.com",
    customerZone: "Herndon",
    status: "Ready",
    serviceDate: "2026-08-03",
    legacyDropDay: null,
    fulfillmentMethod: "pickup",
    serviceWindow: "Pickup",
    totalCents: 2100,
    customRequest: null,
    operatorNote: null,
    paymentProvider: "Stripe",
    paymentStatus: "paid",
    createdAt: "2026-08-03T10:00:00.000Z",
    updatedAt: "2026-08-03T10:00:00.000Z",
    items: [],
    ...overrides,
  };
}

function subscriber(overrides = {}) {
  return {
    id: "subscriber-1",
    email: "news@example.com",
    source: "website",
    signupLocation: "footer",
    status: "Active",
    notes: null,
    lastRequestedAt: "2026-08-03T12:00:00.000Z",
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-03T12:00:00.000Z",
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    id: "event-1",
    orderId: "order-1",
    fromStatus: "In Prep",
    toStatus: "Ready",
    orderVersion: 2,
    changedBy: "actor-1",
    changedAt: "2026-08-03T12:00:00.000Z",
    ...overrides,
  };
}

test("normalizes customer search and searches every required directory field", () => {
  const item = customer();
  assert.equal(normalizeCustomerSearch("  Amina   NOOR "), "amina noor");
  for (const query of ["amina", "amina@example.com", "herndon", "high", "early pickup"]) {
    assert.equal(filterCustomerDirectory(buildCustomerDirectoryRows([item], []), { search: query, loyaltyTier: "all", zone: "all", sort: "loyalty" }).length, 1, query);
  }
});

test("filters loyalty tier and real zones", () => {
  const rows = buildCustomerDirectoryRows([
    customer({ id: "vip", loyaltyTier: "VIP", zone: "Vienna" }),
    customer({ id: "early", loyaltyTier: "Early", zone: "Herndon" }),
  ], []);
  assert.deepEqual(filterCustomerDirectory(rows, { search: "", loyaltyTier: "VIP", zone: "all", sort: "loyalty" }).map((row) => row.customer.id), ["vip"]);
  assert.deepEqual(filterCustomerDirectory(rows, { search: "", loyaltyTier: "all", zone: "Herndon", sort: "loyalty" }).map((row) => row.customer.id), ["early"]);
});

test("default sorting uses loyalty, lifetime value, normalized name, and ID tie-breakers", () => {
  const rows = buildCustomerDirectoryRows([
    customer({ id: "z", name: "Same Name", loyaltyTier: "High", lifetimeValueCents: 5000 }),
    customer({ id: "a", name: "Same Name", loyaltyTier: "High", lifetimeValueCents: 5000 }),
    customer({ id: "vip", name: "Zulu", loyaltyTier: "VIP", lifetimeValueCents: 1 }),
  ], []);
  assert.deepEqual(sortCustomerDirectory(rows).map((row) => row.customer.id), ["vip", "a", "z"]);
  assert.deepEqual(sortCustomerDirectory(rows, "name").map((row) => row.customer.id), ["a", "z", "vip"]);
});

test("normalizes unsupported loyalty values safely", () => {
  assert.equal(normalizeLoyaltyTier("VIP"), "VIP");
  assert.equal(normalizeLoyaltyTier("new"), "Early");
  assert.equal(normalizeLoyaltyTier("unexpected-database-value"), "Early");
  assert.equal(normalizeLoyaltyTier(null), "Early");
});

test("associates orders only by exact customer ID and keeps email matches separate", () => {
  const item = customer();
  const associations = associateCustomerOrders(item, [
    order({ id: "direct" }),
    order({ id: "email-only", customerId: null }),
    order({ id: "name-only", customerId: "other", customerName: item.name }),
  ]);
  assert.deepEqual(associations.directOrders.map((item) => item.id), ["direct"]);
  assert.deepEqual(associations.possibleEmailMatches.map((item) => item.id), ["email-only"]);
});

test("linked totals exclude possible email matches and mismatch detection is informational", () => {
  const item = customer({ totalOrders: 1, lifetimeValueCents: 2100 });
  const rows = buildCustomerDirectoryRows([item], [order(), order({ id: "email-only", customerId: null, totalCents: 900 })]);
  assert.equal(rows[0].directOrders.length, 1);
  assert.equal(rows[0].possibleEmailMatches.length, 1);
  assert.deepEqual(getStoredSummaryMismatch(item, rows[0].directOrders), { totalOrders: false, lifetimeValueCents: false });
});

test("customer summary counts are deterministic and do not duplicate rows", () => {
  const rows = buildCustomerDirectoryRows([customer(), customer({ id: "customer-2", loyaltyTier: "VIP" })], [order()]);
  assert.deepEqual(getCustomerSummaryCounts(rows), { storedCustomers: 2, vipRecords: 1, directlyLinkedOrders: 1, unlinkedEmailMatchCandidates: 0 });
});

test("subscriber classification and deterministic sorting are read-only", () => {
  const updates = [
    subscriber({ id: "b", email: "z@example.com", status: "Unsubscribed", lastRequestedAt: "2026-08-02T12:00:00.000Z" }),
    subscriber({ id: "a", email: "a@example.com", lastRequestedAt: "2026-08-03T12:00:00.000Z" }),
  ];
  assert.equal(classifySubscriberStatus(updates[0]), "unsubscribed");
  assert.deepEqual(sortSubscribers(updates).map((item) => item.id), ["a", "b"]);
  assert.deepEqual(sortSubscribers(updates, "email").map((item) => item.id), ["a", "b"]);
});

test("loaded empty and unavailable optional sources remain distinct", () => {
  assert.equal(getWorkspaceCompleteness({ customerCount: 2, subscriberAvailability: { status: "loaded" }, activityAvailability: { status: "loaded" }, activityCount: 0 }), "complete");
  assert.equal(getWorkspaceCompleteness({ customerCount: 0, subscriberAvailability: { status: "loaded" }, activityAvailability: { status: "loaded" }, activityCount: 0 }), "empty");
  assert.equal(getWorkspaceCompleteness({ customerCount: 2, subscriberAvailability: { status: "unavailable" }, activityAvailability: { status: "loaded" }, activityCount: 0 }), "degraded");
  assert.equal(getWorkspaceCompleteness({ customerCount: 2, subscriberAvailability: { status: "loaded" }, activityAvailability: { status: "unavailable" }, activityCount: 0 }), "degraded");
});

test("activity is newest-first with deterministic tie-breaking and no duplicate event rendering", () => {
  const sorted = sortActivityEvents([
    event({ id: "b", orderVersion: 1, changedAt: "2026-08-03T12:00:00.000Z" }),
    event({ id: "a", orderVersion: 1, changedAt: "2026-08-03T12:00:00.000Z" }),
    event({ id: "duplicate", changedAt: "2026-08-02T12:00:00.000Z" }),
    event({ id: "duplicate", changedAt: "2026-08-01T12:00:00.000Z" }),
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["a", "b", "duplicate"]);
});

test("activity search uses order, exact-linked customer, and transition fields", () => {
  const item = enrichActivityEvents([event()], [order()], [customer()])[0];
  for (const query of ["MG-2001", "Amina", "in prep", "ready"]) assert.equal(activityMatchesSearch(item, query), true, query);
  const nameOnly = enrichActivityEvents([event()], [order({ customerId: null })], [customer()])[0];
  assert.equal(activityMatchesSearch(nameOnly, "Amina"), false);
  assert.deepEqual(filterActivityWorkspace([item], { search: "ready", status: "Ready" }), [item]);
  assert.deepEqual(filterActivityWorkspace([item], { search: "ready", status: "Cancelled" }), []);
});

test("activity enrichment handles missing order, missing customer, and actor state", () => {
  const enriched = enrichActivityEvents([
    event({ id: "missing-order", orderId: "missing" }),
    event({ id: "missing-customer", orderId: "order-missing-customer", changedBy: null }),
  ], [order({ id: "order-missing-customer", customerId: "unknown-customer" })], [customer()]);
  const missingOrder = enriched.find((item) => item.event.id === "missing-order");
  const missingCustomer = enriched.find((item) => item.event.id === "missing-customer");
  assert.equal(missingOrder?.order, null);
  assert.equal(missingOrder?.customer, null);
  assert.equal(missingOrder?.actorState, "recorded");
  assert.equal(missingCustomer?.order?.id, "order-missing-customer");
  assert.equal(missingCustomer?.customer, null);
  assert.equal(missingCustomer?.actorState, "unavailable");
});

test("activity scope is explicit and bounded", () => {
  assert.equal(ACTIVITY_SCOPE, "order-status-events-only");
});
