import type { InventoryItem, MenuAvailability, MenuItem } from "../../types/domain.ts";

export type MenuAvailabilityFilter = "all" | MenuAvailability;
export type MenuMediaFilter = "all" | "ready" | "missing";
export type MenuMediaState = "stored" | "external" | "missing";
export type MenuAttentionReason = "state-mismatch" | "missing-media" | "ingredient-risk";

export interface MenuWorkspaceQuery {
  availability: MenuAvailabilityFilter;
  category: string;
  media: MenuMediaFilter;
  featuredOnly: boolean;
  search: string;
}

export interface MenuCategoryOption {
  value: string;
  label: string;
  count: number;
}

export interface MenuInventoryRisk {
  id: string;
  name: string;
  status: "Low" | "Out";
}

export interface MenuWorkspaceCounts {
  total: number;
  Live: number;
  Watch: number;
  Paused: number;
  "Sold Out": number;
  offline: number;
  mediaReady: number;
  mediaMissing: number;
  featured: number;
  attention: number;
  linkedDishes: number;
}

export interface MenuWorkspacePartition {
  attentionItems: MenuItem[];
  catalogItems: MenuItem[];
}

const ATTENTION_PRIORITY: Record<MenuAttentionReason, number> = {
  "state-mismatch": 0,
  "missing-media": 1,
  "ingredient-risk": 2,
};

const RISK_PRIORITY: Record<MenuInventoryRisk["status"], number> = {
  Out: 0,
  Low: 1,
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function getMenuMediaState(item: MenuItem): MenuMediaState {
  if (item.imagePath?.trim()) return "stored";
  if (item.storedImageUrl?.trim() || item.imageUrl?.trim()) return "external";
  return "missing";
}

export function deriveMenuCategories(items: MenuItem[]): MenuCategoryOption[] {
  const categories = new Map<string, MenuCategoryOption>();

  for (const item of items) {
    const label = item.category.trim();
    if (!label) continue;

    const value = normalize(label);
    const existing = categories.get(value);
    if (existing) {
      existing.count += 1;
      continue;
    }

    categories.set(value, { value, label, count: 1 });
  }

  return [...categories.values()].sort((left, right) => compareText(left.label, right.label));
}

export function menuMatchesSearch(item: MenuItem, search: string) {
  const query = normalize(search);
  if (!query) return true;

  return [item.name, item.slug, item.category, item.availability, item.description, item.notes]
    .map(normalize)
    .join("\n")
    .includes(query);
}

export function menuMatchesAvailability(item: MenuItem, availability: MenuAvailabilityFilter) {
  return availability === "all" || item.availability === availability;
}

export function menuMatchesCategory(item: MenuItem, category: string) {
  return category === "all" || normalize(item.category) === normalize(category);
}

export function menuMatchesMedia(item: MenuItem, media: MenuMediaFilter) {
  if (media === "all") return true;
  const state = getMenuMediaState(item);
  return media === "missing" ? state === "missing" : state !== "missing";
}

export function filterMenuWorkspace(items: MenuItem[], query: MenuWorkspaceQuery) {
  return items.filter(
    (item) =>
      menuMatchesAvailability(item, query.availability) &&
      menuMatchesCategory(item, query.category) &&
      menuMatchesMedia(item, query.media) &&
      (!query.featuredOnly || item.isFeatured) &&
      menuMatchesSearch(item, query.search),
  );
}

export function sortMenuSiteOrder(items: MenuItem[]) {
  return [...items].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      compareText(left.name, right.name) ||
      compareText(left.id, right.id),
  );
}

export function buildMenuInventoryRiskMap(inventory: InventoryItem[]) {
  const riskMap = new Map<string, MenuInventoryRisk[]>();

  for (const stockItem of inventory) {
    if (stockItem.status !== "Low" && stockItem.status !== "Out") continue;

    for (const linkedItem of stockItem.linkedMenuItems) {
      const current = riskMap.get(linkedItem.id) ?? [];
      if (!current.some((risk) => risk.id === stockItem.id)) {
        current.push({ id: stockItem.id, name: stockItem.name, status: stockItem.status });
        current.sort(
          (left, right) =>
            RISK_PRIORITY[left.status] - RISK_PRIORITY[right.status] || compareText(left.name, right.name),
        );
        riskMap.set(linkedItem.id, current);
      }
    }
  }

  return riskMap;
}

export function getRecordedMenuLinkIds(inventory: InventoryItem[]) {
  const ids = new Set<string>();
  for (const item of inventory) {
    for (const linked of item.linkedMenuItems) ids.add(linked.id);
  }
  return ids;
}

export function getMenuAttentionReasons(item: MenuItem, risks: MenuInventoryRisk[] = []): MenuAttentionReason[] {
  const reasons: MenuAttentionReason[] = [];
  const shouldBeActive = item.availability === "Live";

  if (typeof item.isActive === "boolean" && item.isActive !== shouldBeActive) {
    reasons.push("state-mismatch");
  }
  if (shouldBeActive && getMenuMediaState(item) === "missing") {
    reasons.push("missing-media");
  }
  if (shouldBeActive && risks.length > 0) {
    reasons.push("ingredient-risk");
  }

  return reasons;
}

export function sortMenuAttention(items: MenuItem[], riskMap: Map<string, MenuInventoryRisk[]>) {
  return [...items].sort((left, right) => {
    const leftReason = getMenuAttentionReasons(left, riskMap.get(left.id))[0];
    const rightReason = getMenuAttentionReasons(right, riskMap.get(right.id))[0];
    const priorityDifference =
      (leftReason ? ATTENTION_PRIORITY[leftReason] : Number.POSITIVE_INFINITY) -
      (rightReason ? ATTENTION_PRIORITY[rightReason] : Number.POSITIVE_INFINITY);

    return (
      priorityDifference ||
      left.sortOrder - right.sortOrder ||
      compareText(left.name, right.name) ||
      compareText(left.id, right.id)
    );
  });
}

export function partitionMenuWorkspace(
  items: MenuItem[],
  riskMap: Map<string, MenuInventoryRisk[]>,
): MenuWorkspacePartition {
  const attention: MenuItem[] = [];
  const catalog: MenuItem[] = [];

  for (const item of items) {
    if (getMenuAttentionReasons(item, riskMap.get(item.id)).length) attention.push(item);
    else catalog.push(item);
  }

  return {
    attentionItems: sortMenuAttention(attention, riskMap),
    catalogItems: sortMenuSiteOrder(catalog),
  };
}

export function getMenuWorkspaceCounts(items: MenuItem[], inventory: InventoryItem[]): MenuWorkspaceCounts {
  const riskMap = buildMenuInventoryRiskMap(inventory);
  const linkedDishes = getRecordedMenuLinkIds(inventory);
  const counts: MenuWorkspaceCounts = {
    total: items.length,
    Live: 0,
    Watch: 0,
    Paused: 0,
    "Sold Out": 0,
    offline: 0,
    mediaReady: 0,
    mediaMissing: 0,
    featured: 0,
    attention: 0,
    linkedDishes: linkedDishes.size,
  };

  for (const item of items) {
    counts[item.availability] += 1;
    if (item.availability === "Paused" || item.availability === "Sold Out") counts.offline += 1;
    if (getMenuMediaState(item) === "missing") counts.mediaMissing += 1;
    else counts.mediaReady += 1;
    if (item.isFeatured) counts.featured += 1;
    if (getMenuAttentionReasons(item, riskMap.get(item.id)).length) counts.attention += 1;
  }

  return counts;
}

export function queryMenuWorkspace(
  items: MenuItem[],
  inventory: InventoryItem[],
  query: MenuWorkspaceQuery,
) {
  const riskMap = buildMenuInventoryRiskMap(inventory);
  const filtered = sortMenuSiteOrder(filterMenuWorkspace(items, query));
  return {
    filtered,
    riskMap,
    ...partitionMenuWorkspace(filtered, riskMap),
  };
}
