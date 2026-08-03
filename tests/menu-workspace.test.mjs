import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMenuInventoryRiskMap,
  deriveMenuCategories,
  filterMenuWorkspace,
  getMenuAttentionReasons,
  getMenuMediaState,
  getMenuWorkspaceCounts,
  menuMatchesSearch,
  partitionMenuWorkspace,
  sortMenuSiteOrder,
} from "../src/lib/dashboard/menu-workspace.ts";
import {
  isMissingOptionalMenuMacroColumn,
  stripOptionalMenuMacroColumns,
} from "../src/lib/menu/menu-write-compat.ts";

function menuItem(overrides = {}) {
  return {
    id: "menu-1",
    slug: "nihari-tacos",
    name: "Nihari Tacos",
    category: "Signature",
    priceCents: 1800,
    availability: "Live",
    allocationLimit: 20,
    description: "Slow-braised beef and chutney.",
    imageUrl: "https://example.com/menu.jpg",
    storedImageUrl: "https://example.com/menu.jpg",
    imagePath: null,
    imageBucket: null,
    sortOrder: 10,
    isFeatured: true,
    isActive: true,
    notes: "Keep featured.",
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    ...overrides,
  };
}

function inventoryItem(overrides = {}) {
  return {
    id: "inventory-1",
    name: "Cilantro",
    unit: "trays",
    onHand: 1,
    parLevel: 2,
    status: "Low",
    lastUpdatedAt: "2026-03-17T21:00:00.000Z",
    notes: null,
    linkedMenuItems: [{ id: "menu-1", name: "Nihari Tacos" }],
    ...overrides,
  };
}

test("counts availability, offline, media, featured, attention, and linked dishes", () => {
  const menu = [
    menuItem(),
    menuItem({ id: "menu-2", availability: "Watch", isActive: false, imageUrl: null, storedImageUrl: null }),
    menuItem({ id: "menu-3", availability: "Paused", isActive: false, isFeatured: false }),
    menuItem({ id: "menu-4", availability: "Sold Out", isActive: false, isFeatured: false }),
  ];
  const counts = getMenuWorkspaceCounts(menu, [inventoryItem()]);

  assert.deepEqual(counts, {
    total: 4,
    Live: 1,
    Watch: 1,
    Paused: 1,
    "Sold Out": 1,
    offline: 2,
    mediaReady: 3,
    mediaMissing: 1,
    featured: 2,
    attention: 1,
    linkedDishes: 1,
  });
});

test("derives only real categories and deduplicates them case-insensitively", () => {
  const categories = deriveMenuCategories([
    menuItem({ category: "Signature" }),
    menuItem({ id: "menu-2", category: " signature " }),
    menuItem({ id: "menu-3", category: "Wings" }),
  ]);

  assert.deepEqual(categories, ["Signature", "Wings"]);
  assert.equal(categories.includes("meal-prep"), false);
});

test("searches name, slug, category, availability, description, and notes", () => {
  const item = menuItem({ notes: "Friday launch item" });
  for (const query of ["nihari", "tacos", "signature", "live", "braised", "friday launch"]) {
    assert.equal(menuMatchesSearch(item, query), true, query);
  }
  assert.equal(menuMatchesSearch(item, "dessert"), false);
});

test("combines availability, category, media, featured, and search filters", () => {
  const items = [
    menuItem(),
    menuItem({ id: "menu-2", category: "Wings", isFeatured: false, imageUrl: null, storedImageUrl: null }),
  ];

  const result = filterMenuWorkspace(items, {
    search: "tacos",
    availability: "Live",
    category: "signature",
    media: "ready",
    featuredOnly: true,
  });

  assert.deepEqual(result.map((item) => item.id), ["menu-1"]);
});

test("classifies stored, external, and missing media", () => {
  assert.equal(getMenuMediaState(menuItem({ imagePath: "items/menu-1/photo.jpg" })), "stored");
  assert.equal(getMenuMediaState(menuItem({ imagePath: null, storedImageUrl: "https://example.com/a.jpg" })), "external");
  assert.equal(getMenuMediaState(menuItem({ imagePath: null, storedImageUrl: null, imageUrl: null })), "missing");
});

test("maps only Low and Out inventory risks", () => {
  const risks = buildMenuInventoryRiskMap([
    inventoryItem(),
    inventoryItem({ id: "inventory-2", name: "Beef", status: "Out" }),
    inventoryItem({ id: "inventory-3", status: "Watch" }),
    inventoryItem({ id: "inventory-4", status: "Healthy" }),
  ]);

  assert.deepEqual(
    risks.get("menu-1")?.map((risk) => [risk.inventoryItemName, risk.status]),
    [["Beef", "Out"], ["Cilantro", "Low"]],
  );
});

test("zero links produces no false ingredient risk", () => {
  const risks = buildMenuInventoryRiskMap([inventoryItem({ linkedMenuItems: [] })]);
  assert.equal(risks.size, 0);
  assert.deepEqual(getMenuAttentionReasons(menuItem(), []), []);
});

test("attention prioritizes visibility mismatch, live missing media, and live ingredient risk", () => {
  const mismatch = getMenuAttentionReasons(menuItem({ isActive: false }), []);
  assert.equal(mismatch[0].kind, "visibility-mismatch");

  const missing = getMenuAttentionReasons(
    menuItem({ imageUrl: null, storedImageUrl: null, imagePath: null }),
    [],
  );
  assert.equal(missing[0].kind, "missing-live-media");

  const ingredient = getMenuAttentionReasons(menuItem(), [
    { inventoryItemId: "inventory-1", inventoryItemName: "Cilantro", status: "Low" },
  ]);
  assert.equal(ingredient[0].kind, "ingredient-risk");
});

test("non-live missing media is not automatically attention", () => {
  const reasons = getMenuAttentionReasons(
    menuItem({ availability: "Watch", isActive: false, imageUrl: null, storedImageUrl: null, imagePath: null }),
    [],
  );
  assert.deepEqual(reasons, []);
});

test("sorts site order deterministically", () => {
  const sorted = sortMenuSiteOrder([
    menuItem({ id: "b", name: "Beta", sortOrder: 10 }),
    menuItem({ id: "c", name: "Alpha", sortOrder: 20 }),
    menuItem({ id: "a", name: "Alpha", sortOrder: 10 }),
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["a", "b", "c"]);
});

test("partitions attention without duplicates and uses severity order", () => {
  const mismatch = menuItem({ id: "mismatch", isActive: false, sortOrder: 50 });
  const missing = menuItem({ id: "missing", imageUrl: null, storedImageUrl: null, imagePath: null, sortOrder: 10 });
  const normal = menuItem({ id: "normal", sortOrder: 1 });
  const partition = partitionMenuWorkspace([normal, missing, mismatch], []);

  assert.deepEqual(partition.attention.map((entry) => entry.item.id), ["mismatch", "missing"]);
  assert.deepEqual(partition.catalog.map((entry) => entry.item.id), ["normal"]);
  assert.equal(new Set([...partition.attention, ...partition.catalog].map((entry) => entry.item.id)).size, 3);
});

test("empty menu produces zero counts and empty partitions", () => {
  assert.deepEqual(getMenuWorkspaceCounts([], []), {
    total: 0,
    Live: 0,
    Watch: 0,
    Paused: 0,
    "Sold Out": 0,
    offline: 0,
    mediaReady: 0,
    mediaMissing: 0,
    featured: 0,
    attention: 0,
    linkedDishes: 0,
  });
  assert.deepEqual(partitionMenuWorkspace([], []), { attention: [], catalog: [] });
});

test("recognizes only named missing macro-column errors", () => {
  for (const column of ["calories", "protein_g", "carbs_g", "fat_g"]) {
    assert.equal(
      isMissingOptionalMenuMacroColumn({ code: "PGRST204", message: `Could not find the '${column}' column` }),
      true,
    );
  }

  assert.equal(isMissingOptionalMenuMacroColumn({ code: "42703", message: "column calories does not exist" }), true);
  assert.equal(isMissingOptionalMenuMacroColumn({ code: "PGRST204", message: "schema cache miss" }), false);
  assert.equal(isMissingOptionalMenuMacroColumn({ code: "42703", message: "column is_active does not exist" }), false);
  assert.equal(isMissingOptionalMenuMacroColumn({ code: "23505", message: "duplicate calories" }), false);
});

test("stripping macro columns preserves is_active, availability, and core fields", () => {
  const stripped = stripOptionalMenuMacroColumns({
    slug: "nihari-tacos",
    availability: "live",
    is_active: true,
    calories: 400,
    protein_g: 20,
    carbs_g: 30,
    fat_g: 10,
  });

  assert.deepEqual(stripped, {
    slug: "nihari-tacos",
    availability: "live",
    is_active: true,
  });
});
