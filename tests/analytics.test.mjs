import assert from "node:assert/strict";
import test from "node:test";

import {
  getAverageFulfillmentMinutes,
  getBestSellers,
  getRepeatCustomerRate,
} from "../src/lib/dashboard/analytics.ts";

function order(overrides = {}) {
  return {
    id: "order-1",
    orderNumber: "SK-1",
    customerName: "Customer",
    customerEmail: "customer@example.com",
    customerZone: "Reston",
    status: "Picked Up",
    serviceDate: "2026-07-30",
    legacyDropDay: null,
    fulfillmentMethod: "pickup",
    serviceWindow: "5:00 PM",
    totalCents: 2500,
    customRequest: null,
    operatorNote: null,
    paymentProvider: "Stripe",
    paymentStatus: "paid",
    createdAt: "2026-07-30T12:00:00.000Z",
    updatedAt: "2026-07-30T20:00:00.000Z",
    pickedUpAt: "2026-07-30T14:00:00.000Z",
    items: [
      {
        id: "item-1",
        orderId: "order-1",
        menuItemId: "meal-1",
        name: "Chicken Karahi Bowl",
        quantity: 2,
        notes: null,
        unitPriceCents: 1250,
      },
    ],
    ...overrides,
  };
}

test("best sellers exclude unpaid and cancelled orders", () => {
  const rows = getBestSellers([
    order(),
    order({ id: "unpaid", paymentStatus: "unpaid", items: [{ ...order().items[0], quantity: 20 }] }),
    order({ id: "cancelled", status: "Cancelled", items: [{ ...order().items[0], quantity: 30 }] }),
  ]);

  assert.deepEqual(rows, [
    {
      name: "Chicken Karahi Bowl",
      quantity: 2,
      revenueCents: 2500,
    },
  ]);
});

test("repeat rate excludes contacts that have never ordered", () => {
  assert.deepEqual(
    getRepeatCustomerRate([
      { totalOrders: 0 },
      { totalOrders: 1 },
      { totalOrders: 2 },
      { totalOrders: 5 },
    ]),
    {
      repeatCount: 2,
      totalCount: 3,
      ratePercent: 67,
    },
  );
});

test("fulfillment speed uses picked-up timestamps rather than later edits", () => {
  const result = getAverageFulfillmentMinutes([
    order({
      createdAt: "2026-07-30T12:00:00.000Z",
      pickedUpAt: "2026-07-30T14:00:00.000Z",
      updatedAt: "2026-08-15T14:00:00.000Z",
    }),
  ]);

  assert.deepEqual(result, {
    averageMinutes: 120,
    sampleSize: 1,
    excludedCount: 0,
  });
});

test("fulfillment speed excludes implausible lifecycle gaps", () => {
  const result = getAverageFulfillmentMinutes([
    order({
      createdAt: "2026-07-01T12:00:00.000Z",
      pickedUpAt: "2026-07-10T12:00:00.000Z",
    }),
  ]);

  assert.deepEqual(result, {
    averageMinutes: null,
    sampleSize: 0,
    excludedCount: 1,
  });
});
