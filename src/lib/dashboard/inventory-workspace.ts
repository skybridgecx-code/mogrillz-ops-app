// @ts-expect-error The native Node test runner resolves this explicit TypeScript extension.
import { deriveInventoryStatus } from "./inventory-status.ts";
import type { InventoryItem, InventoryStatus } from "../../types/domain.ts";

export type InventoryWorkspaceFilter = "all" | "attention" | InventoryStatus;

export interface InventoryWorkspaceQuery {
  filter: InventoryWorkspaceFilter;
  search: string;
}

export interface InventoryWorkspaceCounts {
  all: number;
  attention: number;
  Out: number;
  Low: number;
  Watch: number;
  Healthy: number;
}

export interface InventoryCoverage {
  percentageOfPar: number | null;
  visualFillPercent: number;
  quantityNeeded: number;
  isParSet: boolean;
}

const STATUS_PRIORITY: Record<InventoryStatus, number> = {
  Out: 0,
  Low: 1,
  Watch: 2,
  Healthy: 3,
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

function isAttentionStatus(status: InventoryStatus) {
  return status === "Out" || status === "Low";
}

export function getInventoryWorkspaceCounts(items: InventoryItem[]): InventoryWorkspaceCounts {
  const counts: InventoryWorkspaceCounts = {
    all: items.length,
    attention: 0,
    Out: 0,
    Low: 0,
    Watch: 0,
    Healthy: 0,
  };

  for (const item of items) {
    counts[item.status] += 1;
    if (isAttentionStatus(item.status)) counts.attention += 1;
  }

  return counts;
}

export function inventoryMatchesSearch(item: InventoryItem, search: string) {
  const query = normalize(search);
  if (!query) return true;

  const searchable = [
    item.name,
    item.unit,
    item.status,
    item.notes,
    ...item.linkedMenuItems.map((linked) => linked.name),
  ]
    .map(normalize)
    .join("\n");

  return searchable.includes(query);
}

export function inventoryMatchesFilter(item: InventoryItem, filter: InventoryWorkspaceFilter) {
  if (filter === "all") return true;
  if (filter === "attention") return isAttentionStatus(item.status);
  return item.status === filter;
}

export function filterInventoryWorkspace(items: InventoryItem[], query: InventoryWorkspaceQuery) {
  return items.filter(
    (item) => inventoryMatchesFilter(item, query.filter) && inventoryMatchesSearch(item, query.search),
  );
}

export function getInventoryCoverage(onHand: number, parLevel: number): InventoryCoverage {
  const quantityNeeded = Math.max(parLevel - onHand, 0);
  if (parLevel <= 0) {
    return {
      percentageOfPar: null,
      visualFillPercent: 0,
      quantityNeeded,
      isParSet: false,
    };
  }

  const percentageOfPar = (Math.max(onHand, 0) / parLevel) * 100;
  return {
    percentageOfPar,
    visualFillPercent: Math.min(Math.max(percentageOfPar, 0), 100),
    quantityNeeded,
    isParSet: true,
  };
}

export function sortInventoryWorkspace(items: InventoryItem[]) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const priorityDifference = STATUS_PRIORITY[left.item.status] - STATUS_PRIORITY[right.item.status];
      if (priorityDifference) return priorityDifference;

      const leftCoverage = getInventoryCoverage(left.item.onHand, left.item.parLevel).percentageOfPar;
      const rightCoverage = getInventoryCoverage(right.item.onHand, right.item.parLevel).percentageOfPar;
      const coverageDifference = (leftCoverage ?? Number.POSITIVE_INFINITY) - (rightCoverage ?? Number.POSITIVE_INFINITY);
      if (coverageDifference) return coverageDifference;

      const nameDifference = left.item.name.localeCompare(right.item.name, undefined, { sensitivity: "base" });
      return nameDifference || left.index - right.index;
    })
    .map(({ item }) => item);
}

export function queryInventoryWorkspace(items: InventoryItem[], query: InventoryWorkspaceQuery) {
  return sortInventoryWorkspace(filterInventoryWorkspace(items, query));
}

export function previewInventoryStatus(onHand: number, parLevel: number) {
  return deriveInventoryStatus(onHand, parLevel);
}
