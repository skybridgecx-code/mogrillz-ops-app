import { NextResponse } from "next/server";

import { deriveInventoryStatus } from "@/lib/dashboard/inventory-status";
import { userHasAdminMembership } from "@/lib/supabase/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const claimsResult = await supabase.auth.getClaims();
  const userId = typeof claimsResult.data?.claims?.sub === "string" ? claimsResult.data.claims.sub : null;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const isAdmin = await userHasAdminMembership(supabase, userId);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

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
    return NextResponse.json({ error: "On-hand and par values must be non-negative numbers." }, { status: 400 });
  }

  if (typeof notes === "undefined") {
    return NextResponse.json({ error: "Inventory note must be under 400 characters." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });
  }

  const existingResult = await adminClient
    .from("inventory_items")
    .select("id")
    .eq("id", inventoryId)
    .single();

  if (existingResult.error || !existingResult.data) {
    return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });
  }

  const status = deriveInventoryStatus(onHand, parLevel);

  const updateResult = await adminClient
    .from("inventory_items")
    .update({
      on_hand_qty: onHand,
      par_level: parLevel,
      notes,
      status: status.toLowerCase(),
    })
    .eq("id", inventoryId)
    .select("id,on_hand_qty,par_level,notes,status")
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ error: "Failed to update inventory item." }, { status: 500 });
  }

  return NextResponse.json({
    id: updateResult.data.id,
    onHand: updateResult.data.on_hand_qty,
    parLevel: updateResult.data.par_level,
    notes: updateResult.data.notes,
    status: updateResult.data.status,
  });
}
