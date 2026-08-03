// @ts-expect-error The native Node test runner resolves this explicit TypeScript extension.
import type {
  InventoryItem,
  InventoryStatus,
  MenuAvailability,
  MenuItem,
} from "../../types/domain.ts";

export type MenuAvailabilityFilter = "all" | MenuAvailability;
export type MenuMediaFilter = "all" | "ready" | "missing";
export type MenuMediaState = "stored" | "external" | "missing";

export interface MenuWorkspaceQuery {
  search: string;
  availability: MenuAvailabilityFilter;
  category: string;
  media: MenuMediaFilter;
  featuredOnly: boolean;
}

export interface MenuInventoryRisk {
  inventoryItemId: string;
  inventoryItemName: string;
  status: Extract<InventoryStatus, "Low" | "Out">;
}

export type MenuAttentionKind =
  | "visibility-mismatch"
  | "missing-live-media"
  | "ingredient-risk";

export interface MenuAttentionReason {
  kind: MenuAttentionKind;
  severity: number;
  message: string;
}

export interface MenuWorkspaceItem {
  item: MenuItem;
  mediaState: MenuMediaState;
  inventoryRisks: MenuInventoryRisk[];
  attentionReasons: MenuAttentionReason[];
}

export interface MenuWorkspacePartition {
  attention: MenuWorkspaceItem[];
  catalog: MenuWorkspaceItem[];
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

const ATTENTION_PRIORITY: Record<MenuAttentionKind, number> = {
  "visibility-mismatch": 0,
  "missing-live-media": 1,
  "ingredient-risk": 2,
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

export function getMenuMediaState(item: MenuItem): MenuMediaState {
  if (item.imagePath?.trim()) return "stored";
  if (item.storedImageUrl?.trim() || item.imageUrl?.trim()) return "external";
  return "missing";
}

export function deriveMenuCategories(items: MenuItem[]) {
  const categories = new Map<string, string>();

  for (const item of items) {
    const display = item.category.trim();
    const key = normalize(display);
    if (key && !categories.has(key)) categories.set(key, display);
  }

  return [...categories.values()].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

export function menuMatchesSearch(item: MenuItem, search: string) {
  const query = normalize(search);
  if (!query) return true;

  return [
    item.name,
    item.slug,
    item.category,
    item.availability,
    item.description,
    item.notes,
  ]
    .map(normalize)
    .join("\n")
    .includes(query);
}

export function buildMenuInventoryRiskMap(inventory: InventoryItem[]) {
  const map = new Map<string, MenuInventoryRisk[]>();

  for (const inventoryItem of inventory) {
    if (inventoryItem.status !== "Low" && inventoryItem.status !== "Out") continue;

    for (const linked of inventoryItem.linkedMenuItems) {
      const current = map.get(linked.id) ?? [];
      current.push({
        inventoryItemId: inventoryItem.id,
        inventoryItemName: inventoryItem.name,
        status: inventoryItem.status,
      });
      map.set(linked.id, current);
    }
  }

  for (const risks of map.values()) {
    risks.sort((left, right) => {
      if (left.status !== right.status) return left.status === "Out" ? -1 : 1;
      return left.inventoryItemName.localeCompare(right.inventoryItemName, undefined, {
        sensitivity: "base",
      });
    });
  }

  return map;
}

export function getMenuAttentionReasons(
  item: MenuItem,
  inventoryRisks: MenuInventoryRisk[],
): MenuAttentionReason[] {
  const reasons: MenuAttentionReason[] = [];
  const shouldBeActive = item.availability === "Live";

  if (typeof item.isActive === "boolean" && item.isActive !== shouldBeActive) {
    reasons.push({
      kind: "visibility-mismatch",
      severity: ATTENTION_PRIORITY["visibility-mismatch"],
      message: "Stored public-visibility state disagrees with availability.",
    });
  }

  if (item.availability === "Live" && getMenuMediaState(item) === "missing") {
    reasons.push({
      kind: "missing-live-media",
      severity: ATTENTION_PRIORITY["missing-live-media"],
      message: "Live item has no recorded image.",
    });
  }

  if (item.availability === "Live" && inventoryRisks.length) {
    reasons.push({
      kind: "ingredient-risk",
      severity: ATTENTION_PRIORITY["ingredient-risk"],
      message: `Linked ingredient risk: ${inventoryRisks
        .map((risk) => `${risk.inventoryItemName} (${risk.status})`)
        .join(", ")}.`,
    });
  }

  return reasons;
}

export function menuMatchesWorkspaceQuery(
  item: MenuItem,
  query: MenuWorkspaceQuery,
) {
  if (query.availability !== "all" && item.availability !== query.availability) {
    return false;
  }

  if (query.category !== "all" && normalize(item.category) !== normalize(query.category)) {
    return false;
  }

  const mediaState = getMenuMediaState(item);
  if (query.media === "missing" && mediaState !== "missing") return false;
  if (query.media === "ready" && mediaState === "missing") return false;
  if (query.featuredOnly && !item.isFeatured) return false;

  return menuMatchesSearch(item, query.search);
}

export function filterMenuWorkspace(items: MenuItem[], query: MenuWorkspaceQuery) {
  return items.filter((item) => menuMatchesWorkspaceQuery(item, query));
}

export function sortMenuSiteOrder(items: MenuItem[]) {
  return [...items].sort((left, right) => {
    const orderDifference = left.sortOrder - right.sortOrder;
    if (orderDifference) return orderDifference;

    const nameDifference = left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    });
    if (nameDifference) return nameDifference;

    return left.id.localeCompare(right.id);
  });
}

function firstAttentionSeverity(item: MenuWorkspaceItem) {
  return item.attentionReasons[0]?.severity ?? Number.POSITIVE_INFINITY;
}

export function partitionMenuWorkspace(
  items: MenuItem[],
  inventory: InventoryItem[],
): MenuWorkspacePartition {
  const risksByMenuId = buildMenuInventoryRiskMap(inventory);
  const wrapped = sortMenuSiteOrder(items).map<MenuWorkspaceItem>((item) => {
    const inventoryRisks = risksByMenuId.get(item.id) ?? [];
    return {
      item,
      mediaState: getMenuMediaState(item),
      inventoryRisks,
      attentionReasons: getMenuAttentionReasons(item, inventoryRisks),
    };
  });

  const attention = wrapped
    .filter((entry) => entry.attentionReasons.length > 0)
    .sort((left, right) => {
      const severityDifference = firstAttentionSeverity(left) - firstAttentionSeverity(right);
      if (severityDifference) return severityDifference;

      const orderDifference = left.item.sortOrder - right.item.sortOrder;
      if (orderDifference) return orderDifference;

      const nameDifference = left.item.name.localeCompare(right.item.name, undefined, {
        sensitivity: "base",
      });
      return nameDifference || left.item.id.localeCompare(right.item.id);
    });

  const attentionIds = new Set(attention.map((entry) => entry.item.id));
  const catalog = wrapped.filter((entry) => !attentionIds.has(entry.item.id));

  return { attention, catalog };
}

export function queryMenuWorkspace(
  menu: MenuItem[],
  inventory: InventoryItem[],
  query: MenuWorkspaceQuery,
) {
  return partitionMenuWorkspace(filterMenuWorkspace(menu, query), inventory);
}

export function getMenuWorkspaceCounts(
  menu: MenuItem[],
  inventory: InventoryItem[],
): MenuWorkspaceCounts {
  const counts: MenuWorkspaceCounts = {
    total: menu.length,
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
  };

  const linkedMenuIds = new Set<string>();
  for (const inventoryItem of inventory) {
    for (const linked of inventoryItem.linkedMenuItems) linkedMenuIds.add(linked.id);
  }

  const risksByMenuId = buildMenuInventoryRiskMap(inventory);

  for (const item of menu) {
    counts[item.availability] += 1;
    if (item.availability === "Paused" || item.availability === "Sold Out") {
      counts.offline += 1;
    }

    if (getMenuMediaState(item) === "missing") counts.mediaMissing += 1;
    else counts.mediaReady += 1;

    if (item.isFeatured) counts.featured += 1;
    if (linkedMenuIds.has(item.id)) counts.linkedDishes += 1;
    if (getMenuAttentionReasons(item, risksByMenuId.get(item.id) ?? []).length) {
      counts.attention += 1;
    }
  }

  return counts;
}
