import assert from "node:assert/strict";
import test from "node:test";

import {
  canCancelOrderStatus,
  getNextOrderStatus,
  isRiskyOrderStatusTransition,
  isValidOrderStatusTransition,
  normalizeOrderStatus,
} from "../src/lib/dashboard/order-status.ts";

test("normalizes supported persisted status variants", () => {
  assert.equal(normalizeOrderStatus("new"), "New");
  assert.equal(normalizeOrderStatus("IN_PREP"), "In Prep");
  assert.equal(normalizeOrderStatus("ready"), "Ready");
  assert.equal(normalizeOrderStatus("picked-up"), "Picked Up");
  assert.equal(normalizeOrderStatus("delivered"), "Picked Up");
  assert.equal(normalizeOrderStatus("cancelled"), "Cancelled");
  assert.equal(normalizeOrderStatus("unknown"), null);
});

test("allows only the forward kitchen workflow", () => {
  assert.equal(getNextOrderStatus("New"), "In Prep");
  assert.equal(getNextOrderStatus("In Prep"), "Ready");
  assert.equal(getNextOrderStatus("Ready"), "Picked Up");
  assert.equal(getNextOrderStatus("Picked Up"), null);

  assert.equal(isValidOrderStatusTransition("New", "In Prep"), true);
  assert.equal(isValidOrderStatusTransition("In Prep", "Ready"), true);
  assert.equal(isValidOrderStatusTransition("Ready", "Picked Up"), true);
  assert.equal(isValidOrderStatusTransition("New", "Ready"), false);
  assert.equal(isValidOrderStatusTransition("Ready", "In Prep"), false);
});

test("allows cancellation only before completion", () => {
  assert.equal(canCancelOrderStatus("New"), true);
  assert.equal(canCancelOrderStatus("In Prep"), true);
  assert.equal(canCancelOrderStatus("Ready"), true);
  assert.equal(canCancelOrderStatus("Picked Up"), false);
  assert.equal(canCancelOrderStatus("Cancelled"), false);

  assert.equal(isValidOrderStatusTransition("New", "Cancelled"), true);
  assert.equal(isValidOrderStatusTransition("Ready", "Cancelled"), true);
  assert.equal(isValidOrderStatusTransition("Picked Up", "Cancelled"), false);
});

test("marks completion and cancellation as risky transitions", () => {
  assert.equal(isRiskyOrderStatusTransition("Ready", "Picked Up"), true);
  assert.equal(isRiskyOrderStatusTransition("New", "Cancelled"), true);
  assert.equal(isRiskyOrderStatusTransition("New", "In Prep"), false);
  assert.equal(isRiskyOrderStatusTransition("In Prep", "Ready"), false);
});
