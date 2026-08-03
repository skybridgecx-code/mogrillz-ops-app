import assert from "node:assert/strict";
import test from "node:test";

import {
  filterInventoryWorkspace,
  getInventoryCoverage,
  getInventoryWorkspaceCounts,
  inventoryMatchesSearch,
  previewInventoryStatus,
  sortInventoryWorkspace,
} from "../src/lib/dashboard/inventory-workspace.ts";

function inventory(overrides = {}) {
  return {
    id: "item-1",
    name: "Red Pickled Onions",
    unit: "trays",
    onHand: 2,
    parLevel: 3,
    status: "Low",
    lastUpdatedAt: "2026-08-02T12:00:00.000Z",
    notes: "Critical bowl garnish",
    linkedMenuItems: [{ id: "dish-1", name: "Chicken Bowl" }],
    ...overrides,
  };
}

test("counts statuses and attention items", () => {
  const items = [
    inventory({ id: "out", status: "Out", onHand: 0 }),
    inventory({ id: "low", status: "Low" }),
    inventory({ id: "watch", status: "Watch" }),
    inventory({ id: "healthy", status: "Healthy" }),
  ];

  assert.deepEqual(getInventoryWorkspaceCounts(items), {
    all: 4,
    attention: 2,
    Out: 1,
    Low: 1,
    Watch: 1,
    Healthy: 1,
  });
});

test("searches item name, unit, notes, and linked menu names", () => {
  const item = inventory();

  assert.equal(inventoryMatchesSearch(item, "pickled onions"), true);
  assert.equal(inventoryMatchesSearch(item, "trays"), true);
  assert.equal(inventoryMatchesSearch(item, "bowl garnish"), true);
  assert.equal(inventoryMatchesSearch(item, "chicken bowl"), true);
  assert.equal(inventoryMatchesSearch(item, "catering"), false);
});

test("combines search with attention and status filters", () => {
  const items = [
    inventory({ id: "onions", name: "Red Pickled Onions", status: "Low", notes: "Supplier Tuesday", linkedMenuItems: [] }),
    inventory({ id: "cilantro", name: "Cilantro", status: "Low", notes: "Bowl garnish" }),
    inventory({ id: "beef", name: "Beef Nihari", status: "Healthy", notes: "Signature protein" }),
  ];

  assert.deepEqual(
    filterInventoryWorkspace(items, { filter: "attention", search: "bowl" }).map((item) => item.id),
    ["cilantro"],
  );
  assert.deepEqual(
    filterInventoryWorkspace(items, { filter: "Healthy", search: "nihari" }).map((item) => item.id),
    ["beef"],
  );
});

test("sorts by status priority and lower coverage within a status", () => {
  const items = [
    inventory({ id: "healthy", name: "Zucchini", status: "Healthy", onHand: 11, parLevel: 10 }),
    inventory({ id: "watch-high", name: "Tomatoes", status: "Watch", onHand: 14, parLevel: 10 }),
    inventory({ id: "out", name: "Garlic", status: "Out", onHand: 0, parLevel: 5 }),
    inventory({ id: "low-high", name: "Cilantro", status: "Low", onHand: 2, parLevel: 3 }),
    inventory({ id: "low-low", name: "Basil", status: "Low", onHand: 1, parLevel: 3 }),
  ];

  assert.deepEqual(sortInventoryWorkspace(items).map((item) => item.id), [
    "out",
    "low-low",
    "low-high",
    "watch-high",
    "healthy",
  ]);
});

test("par zero is unavailable and never reports 100 percent", () => {
  assert.deepEqual(getInventoryCoverage(5, 0), {
    percentageOfPar: null,
    visualFillPercent: 0,
    quantityNeeded: 0,
    isParSet: false,
  });
});

test("calculates quantity needed to reach par", () => {
  assert.equal(getInventoryCoverage(2, 7).quantityNeeded, 5);
  assert.equal(getInventoryCoverage(9, 7).quantityNeeded, 0);
});

test("keeps displayed over-par coverage while capping visual fill", () => {
  const coverage = getInventoryCoverage(18, 10);

  assert.equal(coverage.percentageOfPar, 180);
  assert.equal(coverage.visualFillPercent, 100);
});

test("empty inventory produces zero counts and no filtered items", () => {
  assert.equal(getInventoryWorkspaceCounts([]).all, 0);
  assert.deepEqual(filterInventoryWorkspace([], { filter: "all", search: "" }), []);
});

test("status preview delegates to the canonical status derivation", () => {
  assert.equal(previewInventoryStatus(0, 10), "Out");
  assert.equal(previewInventoryStatus(2, 10), "Low");
  assert.equal(previewInventoryStatus(10, 10), "Watch");
  assert.equal(previewInventoryStatus(16, 10), "Healthy");
  assert.equal(previewInventoryStatus(1, 0), "Healthy");
});
