import type { InventoryStatus } from "@/types/domain";

export function deriveInventoryStatus(onHand: number, parLevel: number): InventoryStatus {
  if (onHand <= 0) return "Out";
  if (parLevel > 0) {
    if (onHand < parLevel) return "Low";
    if (onHand <= parLevel * 1.5) return "Watch";
  }

  return "Healthy";
}
