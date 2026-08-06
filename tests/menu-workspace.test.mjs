import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = await import("../src/lib/dashboard/menu-workspace.ts");
const compat = await import("../src/lib/menu/menu-write-compat.ts");

function menuItem(overrides = {}) {
  return {
    id: "menu-1",
    slug: "nihari-tacos",
    name: "Nihari Tacos",
    category: "Signature",
    priceCents: 1800,
    availability: "Live",
    allocationLimit: 20,
    description: "Slow-braised beef with chutney.",
    imageUrl: "https://example.com/nihari.jpg",
    storedImageUrl: "https://example.com/nihari.jpg",
    imagePath: null,
    imageBucket: null,
    sortOrder: 10,
    isFeatured: false,
    isActive: true,
    notes: "Core menu item",
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
    ...overrides,
  };
}

function inventoryItem(overrides = {}) {
  return {
    id: "inv-1",
    name: "Pickled Onions",
    unit: "trays",
    onHand: 1,
    parLevel: 3,
    status: "Low",
    lastUpdatedAt: "2026-08-02T00:00:00.000Z",
    notes: null,
    linkedMenuItems: [{ id: "menu-1", name: "Nihari Tacos" }],
    ...overrides,
  };
}

test("counts availability, offline, media, featured, attention, and links", () => {
  const items = [
    menuItem(),
    menuItem({ id: "menu-2", availability: "Watch", isActive: false, imageUrl: null, storedImageUrl: null }),
    menuItem({ id: "menu-3", availability: "Paused", isActive: false, imagePath: "items/3/photo.webp" }),
    menuItem({ id: "menu-4", availability: "Sold Out", isActive: false, isFeatured: true, imageUrl: null, storedImageUrl: null }),
  ];
  const counts = workspace.getMenuWorkspaceCounts(items, [inventoryItem()]);

  assert.deepEqual(counts, {
    total: 4,
    Live: 1,
    Watch: 1,
    Paused: 1,
    "Sold Out": 1,
    offline: 2,
    mediaReady: 2,
    mediaMissing: 2,
    featured: 1,
    attention: 1,
    linkedDishes: 1,
  });
});

test("derives real categories only and deduplicates case-insensitively", () => {
  const categories = workspace.deriveMenuCategories([
    menuItem({ category: "Bowls" }),
    menuItem({ id: "menu-2", category: " bowls " }),
    menuItem({ id: "menu-3", category: "Wings" }),
    menuItem({ id: "menu-4", category: "" }),
  ]);

  assert.deepEqual(categories, [
    { value: "bowls", label: "Bowls", count: 2 },
    { value: "wings", label: "Wings", count: 1 },
  ]);
  assert.equal(categories.some((category) => category.value === "meal-prep"), false);
});

test("searches every required menu field", () => {
  const item = menuItem({
    name: "Lamb Bowl",
    slug: "lamb-bowl",
    category: "Bowls",
    availability: "Watch",
    description: "Tender lamb and rice",
    notes: "Premium upsell",
  });

  for (const query of ["lamb bowl", "lamb-bowl", "bowls", "watch", "tender lamb", "premium upsell"]) {
    assert.equal(workspace.menuMatchesSearch(item, query), true, query);
  }
  assert.equal(workspace.menuMatchesSearch(item, "wings"), false);
});

test("combines availability, category, media, featured, and search filters", () => {
  const items = [
    menuItem({ id: "menu-1", category: "Bowls", isFeatured: true, imagePath: "items/1/a.webp" }),
    menuItem({ id: "menu-2", category: "Bowls", availability: "Watch", isActive: false, isFeatured: true }),
    menuItem({ id: "menu-3", category: "Wings", isFeatured: true }),
    menuItem({ id: "menu-4", category: "Bowls", isFeatured: false }),
  ];

  const result = workspace.filterMenuWorkspace(items, {
    availability: "Live",
    category: "bowls",
    media: "ready",
    featuredOnly: true,
    search: "nihari",
  });

  assert.deepEqual(result.map((item) => item.id), ["menu-1"]);
});

test("classifies stored, external, and missing media", () => {
  assert.equal(workspace.getMenuMediaState(menuItem({ imagePath: "items/1/a.webp" })), "stored");
  assert.equal(workspace.getMenuMediaState(menuItem({ imagePath: null, storedImageUrl: "https://example.com/a.jpg" })), "external");
  assert.equal(workspace.getMenuMediaState(menuItem({ imagePath: null, storedImageUrl: null, imageUrl: "https://signed.example/a" })), "external");
  assert.equal(workspace.getMenuMediaState(menuItem({ imagePath: null, storedImageUrl: null, imageUrl: null })), "missing");
});

test("maps only Low and Out inventory risks", () => {
  const riskMap = workspace.buildMenuInventoryRiskMap([
    inventoryItem({ id: "out", name: "Chicken", status: "Out" }),
    inventoryItem({ id: "low", name: "Onions", status: "Low" }),
    inventoryItem({ id: "watch", name: "Rice", status: "Watch" }),
    inventoryItem({ id: "healthy", name: "Sauce", status: "Healthy" }),
  ]);

  assert.deepEqual(riskMap.get("menu-1"), [
    { id: "out", name: "Chicken", status: "Out" },
    { id: "low", name: "Onions", status: "Low" },
  ]);
});

test("zero links create no false ingredient risk", () => {
  const item = menuItem();
  const riskMap = workspace.buildMenuInventoryRiskMap([inventoryItem({ linkedMenuItems: [] })]);
  assert.equal(riskMap.has(item.id), false);
  assert.deepEqual(workspace.getMenuAttentionReasons(item, riskMap.get(item.id)), []);
});

test("derives attention reasons without treating non-live missing media as a defect", () => {
  assert.deepEqual(workspace.getMenuAttentionReasons(menuItem({ isActive: false })), ["state-mismatch"]);
  assert.deepEqual(workspace.getMenuAttentionReasons(menuItem({ imageUrl: null, storedImageUrl: null })), ["missing-media"]);
  assert.deepEqual(
    workspace.getMenuAttentionReasons(menuItem(), [{ id: "inv", name: "Onions", status: "Low" }]),
    ["ingredient-risk"],
  );
  assert.deepEqual(
    workspace.getMenuAttentionReasons(menuItem({ availability: "Watch", isActive: false, imageUrl: null, storedImageUrl: null })),
    [],
  );
});

test("sorts site order deterministically", () => {
  const sorted = workspace.sortMenuSiteOrder([
    menuItem({ id: "b", name: "Same", sortOrder: 20 }),
    menuItem({ id: "c", name: "Zulu", sortOrder: 10 }),
    menuItem({ id: "a", name: "Same", sortOrder: 20 }),
    menuItem({ id: "d", name: "Alpha", sortOrder: 10 }),
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ["d", "c", "a", "b"]);
});

test("sorts attention by reason severity then site order", () => {
  const mismatch = menuItem({ id: "mismatch", isActive: false, sortOrder: 99 });
  const missing = menuItem({ id: "missing", imageUrl: null, storedImageUrl: null, sortOrder: 50 });
  const risk = menuItem({ id: "risk", sortOrder: 1 });
  const riskMap = new Map([["risk", [{ id: "inv", name: "Onions", status: "Low" }]]]);

  const sorted = workspace.sortMenuAttention([risk, missing, mismatch], riskMap);
  assert.deepEqual(sorted.map((item) => item.id), ["mismatch", "missing", "risk"]);
});

test("partitions without duplicates", () => {
  const attention = menuItem({ id: "attention", imageUrl: null, storedImageUrl: null });
  const clean = menuItem({ id: "clean" });
  const partition = workspace.partitionMenuWorkspace([attention, clean], new Map());

  assert.deepEqual(partition.attentionItems.map((item) => item.id), ["attention"]);
  assert.deepEqual(partition.catalogItems.map((item) => item.id), ["clean"]);
  assert.equal(new Set([...partition.attentionItems, ...partition.catalogItems].map((item) => item.id)).size, 2);
});

test("empty menu behavior is stable", () => {
  const counts = workspace.getMenuWorkspaceCounts([], []);
  const query = workspace.queryMenuWorkspace([], [], {
    availability: "all",
    category: "all",
    media: "all",
    featuredOnly: false,
    search: "",
  });

  assert.equal(counts.total, 0);
  assert.deepEqual(query.filtered, []);
  assert.deepEqual(query.attentionItems, []);
  assert.deepEqual(query.catalogItems, []);
});

test("recognizes only named optional macro-column failures", () => {
  for (const column of compat.OPTIONAL_MENU_MACRO_COLUMNS) {
    assert.equal(
      compat.isMissingOptionalMenuMacroColumn({ code: "PGRST204", message: `Could not find the '${column}' column` }),
      true,
    );
    assert.equal(
      compat.isMissingOptionalMenuMacroColumn({ code: "42703", message: `column ${column} does not exist` }),
      true,
    );
  }

  assert.equal(compat.isMissingOptionalMenuMacroColumn({ code: "PGRST204", message: "schema cache miss" }), false);
  assert.equal(compat.isMissingOptionalMenuMacroColumn({ code: "42703", message: "column is_active does not exist" }), false);
  assert.equal(compat.isMissingOptionalMenuMacroColumn({ code: "23505", message: "calories duplicate" }), false);
});

test("stripping macros preserves is_active, availability, and core fields", () => {
  const payload = {
    slug: "dish",
    name: "Dish",
    availability: "live",
    is_active: true,
    price_cents: 1500,
    calories: null,
    protein_g: 20,
    carbs_g: null,
    fat_g: 10,
  };

  const stripped = compat.stripOptionalMenuMacroColumns(payload);
  assert.deepEqual(stripped, {
    slug: "dish",
    name: "Dish",
    availability: "live",
    is_active: true,
    price_cents: 1500,
  });
  assert.equal(payload.protein_g, 20);
});

test("shared Sheet uses a neutral host for dialog semantics", () => {
  const source = readFileSync(
    new URL("../src/components/ui/sheet.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<div\b[^>]*\brole="dialog"/);
  assert.doesNotMatch(source, /<aside\b[^>]*\brole="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby=\{titleId\}/);
});

test("menu dependency notice is not a nested complementary landmark", () => {
  const source = readFileSync(
    new URL(
      "../src/components/dashboard/views/menu-view.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    source,
    /<Panel as="div" className="menu-dependency">/,
  );
  assert.doesNotMatch(
    source,
    /<Panel as="aside" className="menu-dependency">/,
  );
});
