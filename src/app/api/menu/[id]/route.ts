import { NextResponse } from "next/server";

import { userHasAdminMembership } from "@/lib/supabase/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MENU_AVAILABILITY_VALUES = ["Live", "Watch", "Paused", "Sold Out"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function readAvailability(value: unknown) {
  if (typeof value !== "string") return undefined;
  return MENU_AVAILABILITY_VALUES.find((option) => option.toLowerCase() === value.trim().toLowerCase());
}

function readAllocationLimit(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return Math.round(parsed);
    }
  }

  return undefined;
}

function readFeatured(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
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

async function resolveMenuId(adminClient: ReturnType<typeof createSupabaseAdminClient>, key: string) {
  if (!adminClient) return null;

  const bySlug = await adminClient.from("menu_items").select("id").eq("slug", key).maybeSingle();
  if (bySlug.data?.id) return bySlug.data.id as string;

  const byId = await adminClient.from("menu_items").select("id").eq("id", key).maybeSingle();
  if (byId.data?.id) return byId.data.id as string;

  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const menuKey = id?.trim();

  if (!menuKey) {
    return NextResponse.json({ error: "Missing menu item id." }, { status: 400 });
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

  let availability: (typeof MENU_AVAILABILITY_VALUES)[number] | undefined;
  let allocationLimit: number | undefined;
  let isFeatured: boolean | undefined;
  let notes: string | null | undefined;

  try {
    const body = await request.json();
    availability = readAvailability(body?.availability);
    allocationLimit = readAllocationLimit(body?.allocationLimit);
    isFeatured = readFeatured(body?.isFeatured);
    notes = readNotes(body?.notes);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!availability || typeof allocationLimit === "undefined" || typeof isFeatured === "undefined") {
    return NextResponse.json(
      { error: "Availability, allocation limit, and featured flag are required." },
      { status: 400 },
    );
  }

  if (typeof notes === "undefined") {
    return NextResponse.json({ error: "Merchandising note must be under 400 characters." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });
  }

  const resolvedMenuId = await resolveMenuId(adminClient, menuKey);
  if (!resolvedMenuId) {
    return NextResponse.json({ error: "Menu item not found." }, { status: 404 });
  }

  const updateResult = await adminClient
    .from("menu_items")
    .update({
      availability: availability.toLowerCase(),
      allocation_limit: allocationLimit,
      is_featured: isFeatured,
      notes,
    })
    .eq("id", resolvedMenuId)
    .select("id,slug,availability,allocation_limit,is_featured,notes")
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ error: "Failed to update menu item." }, { status: 500 });
  }

  return NextResponse.json({
    id: updateResult.data.id,
    slug: updateResult.data.slug,
    availability: updateResult.data.availability,
    allocationLimit: updateResult.data.allocation_limit,
    isFeatured: updateResult.data.is_featured,
    notes: updateResult.data.notes,
  });
}
