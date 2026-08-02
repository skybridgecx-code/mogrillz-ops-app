import assert from "node:assert/strict";
import test from "node:test";

import {
  filterOrderWorkspace,
  getOrderItemCount,
  getOrderWorkspaceCounts,
  orderMatchesSearch,
} from "../src/lib/dashboard/order-workspace.ts";

function order(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    orderNumber: "MG-1001",
    customerName: "Fatima Noor",
    customerEmail: "fatima@example.com",
    customerZone: "Vienna",
    status: "New",
    serviceDate: "2026-08-02",
    legacyDropDay: null,
    fulfillmentMethod: "pickup",
    serviceWindow: "5:00 PM",
    totalCents: 3200,
    customRequest: "Text on arrival",
    operatorNote: "Pack chutney separately",
    paymentProvider: "Stripe",
    paymentStatus: "paid",
    createdAt: "2026-08-02T20:00:00.000Z",
    updatedAt: "2026-08-02T20:00:00.000Z",
    items: [
      {
        id: "line-1",
        orderId: "order-1",
        menuItemId: "dish-1",
        name: "Nihari Tacos",
        quantity: 2,
        notes: "No onions",
        unitPriceCents: 1600,
      },
    ],
    ...overrides,
  };
}

test("counts workflow states without treating cancelled orders as active", () => {
  const orders = [
    order({ id: "new", status: "New" }),
    order({ id: "prep", status: "In Prep" }),
    order({ id: "ready", status: "Ready" }),
    order({ id: "done", status: "Picked Up" }),
    order({ id: "cancelled", status: "Cancelled" }),
  ];

  assert.deepEqual(getOrderWorkspaceCounts(orders), {
    all: 4,
    active: 3,
    New: 1,
    "In Prep": 1,
    Ready: 1,
    "Picked Up": 1,
    Cancelled: 1,
  });
});

test("searches customer, order, item, note, and fulfillment fields", () => {
  const sample = order();

  assert.equal(orderMatchesSearch(sample, "mg-1001"), true);
  assert.equal(orderMatchesSearch(sample, "fatima"), true);
  assert.equal(orderMatchesSearch(sample, "nihari"), true);
  assert.equal(orderMatchesSearch(sample, "no onions"), true);
  assert.equal(orderMatchesSearch(sample, "pack chutney"), true);
  assert.equal(orderMatchesSearch(sample, "pickup"), true);
  assert.equal(orderMatchesSearch(sample, "sterling"), false);
});

test("combines status filters with search and always excludes cancelled orders", () => {
  const orders = [
    order({ id: "new-fatima", status: "New" }),
    order({ id: "ready-fatima", status: "Ready" }),
    order({ id: "ready-hamza", status: "Ready", customerName: "Hamza Ali" }),
    order({ id: "cancelled-fatima", status: "Cancelled" }),
  ];

  assert.deepEqual(
    filterOrderWorkspace(orders, { filter: "Ready", search: "fatima" }).map((row) => row.id),
    ["ready-fatima"],
  );
  assert.deepEqual(
    filterOrderWorkspace(orders, { filter: "active", search: "" }).map((row) => row.id),
    ["new-fatima", "ready-fatima", "ready-hamza"],
  );
  assert.equal(filterOrderWorkspace(orders, { filter: "all", search: "" }).length, 3);
});

test("reports total item quantity rather than line count", () => {
  const sample = order({
    items: [
      { id: "1", quantity: 2, name: "Tacos" },
      { id: "2", quantity: 3, name: "Wings" },
    ],
  });

  assert.equal(getOrderItemCount(sample), 5);
});
