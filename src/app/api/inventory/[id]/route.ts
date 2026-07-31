import { NextResponse } from "next/server";

import { deriveInventoryStatus } from "@/lib/dashboard/inventory-status";
import { requireAdminRouteContext } from "@/lib/supabase/admin-context";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function readQuantity(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function readNotes(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 400) return undefined;

  return normalized;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const inventoryId = id?.trim();

  if (!inventoryId) {
    return NextResponse.json({ error: "Missing inventory id." }, { status: 400 });
  }

  const authResult = await requireAdminRouteContext();
  if (!authResult.ok) return authResult.response;

  let onHand: number | undefined;
  let parLevel: number | undefined;
  let notes: string | null | undefined;

  try {
    const body = await request.json();
    onHand = readQuantity(body?.onHand);
    parLevel = readQuantity(body?.parLevel);
    notes = readNotes(body?.notes);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof onHand === "undefined" || typeof parLevel === "undefined") {
    return NextResponse.json(
      { error: "On-hand and par values must be non-negative numbers." },
      { status: 400 },
    );
  }

  if (typeof notes === "undefined") {
    return NextResponse.json(
      { error: "Inventory note must be under 400 characters." },
      { status: 400 },
    );
  }

  const status = deriveInventoryStatus(onHand, parLevel);
  const updateResult = await authResult.context.supabase
    .from("inventory_items")
    .update({
      on_hand_qty: onHand,
      par_level: parLevel,
      notes,
      status: status.toLowerCase(),
    })
    .eq("id", inventoryId)
    .select("id,on_hand_qty,par_level,notes,status")
    .maybeSingle();

  if (updateResult.error) {
    console.error("[api/inventory] update failed", {
      inventoryId,
      code: updateResult.error.code,
      message: updateResult.error.message,
    });
    return NextResponse.json({ error: "Failed to update inventory item." }, { status: 500 });
  }

  if (!updateResult.data) {
    return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: updateResult.data.id,
    onHand: updateResult.data.on_hand_qty,
    parLevel: updateResult.data.par_level,
    notes: updateResult.data.notes,
    status: updateResult.data.status,
  });
}
