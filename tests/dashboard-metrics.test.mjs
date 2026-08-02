import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanonicalKpis,
  getBusinessDateKey,
  normalizePaymentStatus,
  withCanonicalMetrics,
} from "../src/lib/dashboard/metrics.ts";

function order(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    orderNumber: "MG-TEST",
    customerName: "Test Customer",
    customerEmail: "test@example.com",
    customerZone: "Fairfax",
    status: "New",
    serviceDate: "2026-08-02",
    legacyDropDay: null,
    fulfillmentMethod: "pickup",
    serviceWindow: "5:00 PM",
    totalCents: 1000,
    customRequest: null,
    operatorNote: null,
    paymentProvider: "Stripe",
    paymentStatus: "paid",
    createdAt: "2026-08-02T12:00:00.000Z",
    updatedAt: "2026-08-02T12:00:00.000Z",
    items: [],
    ...overrides,
  };
}

function inventory(status) {
  return {
    id: crypto.randomUUID(),
    name: `${status} item`,
    unit: "units",
    onHand: 1,
    parLevel: 1,
    status,
    lastUpdatedAt: "2026-08-02T12:00:00.000Z",
    notes: null,
    linkedMenuItems: [],
  };
}

function snapshot(kpis, orders, stock) {
  return {
    generatedAt: "2026-08-03T03:59:59.000Z",
    operations: {
      serviceDateLabel: "Aug 2",
      status: "Orders Active",
      queueSummary: "Test queue",
      serviceWindow: "5:00 PM",
    },
    kpis,
    orders,
    inventory: stock,
    menu: [],
    customers: [],
    emailUpdates: [],
    insights: [],
  };
}

test("resolves the Eastern business date across the UTC midnight boundary", () => {
  assert.equal(getBusinessDateKey("2026-08-03T03:59:59.000Z"), "2026-08-02");
  assert.equal(getBusinessDateKey("2026-08-03T04:00:00.000Z"), "2026-08-03");
});

test("normalizes only the supported paid-status spellings", () => {
  assert.equal(normalizePaymentStatus(" PAID "), "paid");
  assert.equal(normalizePaymentStatus("Captured"), "captured");
  assert.equal(normalizePaymentStatus("succeeded"), "succeeded");
  assert.equal(normalizePaymentStatus("payment pending"), "payment_pending");
});

test("builds truthful service, revenue, and stock metrics", () => {
  const orders = [
    order({ id: "paid", paymentStatus: "paid", totalCents: 1000, fulfillmentMethod: "pickup" }),
    order({ id: "captured", paymentStatus: "CAPTURED", totalCents: 2000, fulfillmentMethod: "delivery" }),
    order({ id: "succeeded", paymentStatus: "succeeded", totalCents: 3000, serviceDate: "2026-08-01" }),
    order({ id: "pending", paymentStatus: "pending", totalCents: 4000, fulfillmentMethod: "pickup" }),
    order({ id: "failed", paymentStatus: "failed", totalCents: 5000, fulfillmentMethod: "delivery" }),
    order({ id: "refunded", paymentStatus: "refunded", totalCents: 6000, fulfillmentMethod: "pickup" }),
    order({ id: "cancelled", status: "Cancelled", paymentStatus: "paid", totalCents: 7000 }),
    order({ id: "unscheduled", paymentStatus: "paid", totalCents: 8000, serviceDate: null }),
  ];
  const stock = [inventory("Healthy"), inventory("Watch"), inventory("Low"), inventory("Out")];

  const kpis = buildCanonicalKpis(orders, stock, {
    now: "2026-08-03T03:59:59.000Z",
  });

  assert.deepEqual(kpis[0], {
    label: "Today's Service Orders",
    value: "5",
    delta: "3 pickup · 2 delivery",
    tone: "gold",
  });
  assert.deepEqual(kpis[1], {
    label: "Paid Revenue",
    value: "$140",
    delta: "4 recognized payments",
    tone: "green",
  });
  assert.deepEqual(kpis[2], {
    label: "Low Stock Items",
    value: "2",
    delta: "Needs attention before prep",
    tone: "red",
  });
  assert.deepEqual(kpis[3], {
    label: "Stock Readiness",
    value: "50%",
    delta: "2 of 4 items ready",
    tone: "blue",
  });
});

test("does not report perfect readiness when inventory is empty", () => {
  const readiness = buildCanonicalKpis([], [], {
    now: "2026-08-03T03:59:59.000Z",
  })[3];

  assert.deepEqual(readiness, {
    label: "Stock Readiness",
    value: "—",
    delta: "No inventory data",
    tone: "blue",
  });
});

test("applies one metric contract regardless of snapshot source", () => {
  const orders = [order()];
  const stock = [inventory("Healthy")];
  const mockSnapshot = snapshot(
    [{ label: "Mock-only", value: "999", delta: "stale", tone: "red" }],
    orders,
    stock,
  );
  const supabaseSnapshot = snapshot([], structuredClone(orders), structuredClone(stock));
  const options = { now: "2026-08-03T03:59:59.000Z" };

  assert.deepEqual(
    withCanonicalMetrics(mockSnapshot, options).kpis,
    withCanonicalMetrics(supabaseSnapshot, options).kpis,
  );
});
