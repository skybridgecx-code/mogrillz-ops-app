import assert from "node:assert/strict";
import test from "node:test";

import {
  getAverageRecognizedOrderValueCents,
  getBusinessDate,
  getInventoryHealthPercent,
  getOrdersForBusinessDate,
  getRecognizedRevenueCents,
  isRecognizedRevenueOrder,
} from "../src/lib/dashboard/metrics.ts";

function order(overrides = {}) {
  return {
    id: "order-1",
    orderNumber: "SK-1",
    customerName: "Customer",
    customerEmail: "customer@example.com",
    customerZone: "Reston",
    status: "New",
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
    updatedAt: "2026-07-30T12:00:00.000Z",
    items: [],
    ...overrides,
  };
}

test("resolves the operating date in America/New_York", () => {
  const lateEveningEastern = new Date("2026-07-31T03:30:00.000Z");
  assert.equal(getBusinessDate(lateEveningEastern), "2026-07-30");
});

test("recognizes revenue only for paid, non-cancelled orders", () => {
  assert.equal(isRecognizedRevenueOrder(order()), true);
  assert.equal(isRecognizedRevenueOrder(order({ paymentStatus: "succeeded" })), true);
  assert.equal(isRecognizedRevenueOrder(order({ paymentStatus: "unpaid" })), false);
  assert.equal(isRecognizedRevenueOrder(order({ paymentStatus: "refunded" })), false);
  assert.equal(isRecognizedRevenueOrder(order({ status: "Cancelled" })), false);
});

test("calculates recognized revenue and average order value", () => {
  const orders = [
    order({ id: "paid-1", totalCents: 2500 }),
    order({ id: "paid-2", totalCents: 3500, paymentStatus: "captured" }),
    order({ id: "unpaid", totalCents: 9000, paymentStatus: "unpaid" }),
    order({ id: "cancelled", totalCents: 8000, status: "Cancelled" }),
  ];

  assert.equal(getRecognizedRevenueCents(orders), 6000);
  assert.equal(getAverageRecognizedOrderValueCents(orders), 3000);
});

test("selects today's service orders rather than every historical row", () => {
  const referenceDate = new Date("2026-07-30T16:00:00.000Z");
  const orders = [
    order({ id: "today", serviceDate: "2026-07-30" }),
    order({ id: "tomorrow", serviceDate: "2026-07-31" }),
    order({ id: "cancelled", serviceDate: "2026-07-30", status: "Cancelled" }),
    order({ id: "unscheduled", serviceDate: null }),
  ];

  assert.deepEqual(
    getOrdersForBusinessDate(orders, referenceDate).map((item) => item.id),
    ["today"],
  );
});

test("reports inventory health without claiming empty inventory is fully ready", () => {
  assert.equal(getInventoryHealthPercent([]), null);
  assert.equal(
    getInventoryHealthPercent([
      { status: "Healthy" },
      { status: "Watch" },
      { status: "Low" },
      { status: "Out" },
    ]),
    50,
  );
});
