import { NextResponse } from "next/server";

import { userHasAdminMembership } from "@/lib/supabase/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MENU_AVAILABILITY_VALUES = ["Live", "Watch", "Paused", "Sold Out"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MenuPayload = {
  slug: string;
  name: string;
  category: string;
  price_cents: number;
  availability: string;
  allocation_limit: number;
  description: string;
  image_url: string | null;
  sort_order: number;
  is_featured: boolean;
  notes: string | null;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function readText(value: unknown, maxLength: number, field: string) {
  if (typeof value !== "string") {
    throw new Error(`${field} is required.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function readOptionalText(value: unknown, maxLength: number) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("Optional text fields must be strings.");
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error(`Optional text fields must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function readAvailability(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Availability is required.");
  }

  const match = MENU_AVAILABILITY_VALUES.find(
    (option) => option.toLowerCase() === value.trim().toLowerCase(),
  );
  if (!match) {
    throw new Error("Availability is invalid.");
  }

  return match.toLowerCase();
}

function readInteger(value: unknown, min: number, max: number, field: string) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be between ${min} and ${max}.`);
  }

  return Math.round(parsed);
}

function readBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be true or false.`);
  }

  return value;
}

function readMenuPayload(body: unknown): MenuPayload {
  const data = (body ?? {}) as Record<string, unknown>;
  const name = readText(data.name, 120, "Name");
  const slugInput = typeof data.slug === "string" ? data.slug : name;
  const slug = slugify(slugInput);

  if (!slug) {
    throw new Error("Slug is required.");
  }

  return {
    slug,
    name,
    category: readText(data.category, 60, "Category"),
    price_cents: readInteger(data.priceCents, 0, 100000, "Price"),
    availability: readAvailability(data.availability),
    allocation_limit: readInteger(data.allocationLimit, 0, 100, "Allocation limit"),
    description: readText(data.description, 500, "Description"),
    image_url: readOptionalText(data.imageUrl, 500),
    sort_order: readInteger(data.sortOrder ?? 0, 0, 100000, "Sort order"),
    is_featured: readBoolean(data.isFeatured, "Featured flag"),
    notes: readOptionalText(data.notes, 400),
  };
}

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase is not configured." }, { status: 500 }) };
  }

  const claimsResult = await supabase.auth.getClaims();
  const userId = typeof claimsResult.data?.claims?.sub === "string" ? claimsResult.data.claims.sub : null;

  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }

  const isAdmin = await userHasAdminMembership(supabase, userId);
  if (!isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return { error: NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 }) };
  }

  return { adminClient };
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

  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  let payload: MenuPayload;

  try {
    payload = readMenuPayload(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const resolvedMenuId = await resolveMenuId(authResult.adminClient, menuKey);
  if (!resolvedMenuId) {
    return NextResponse.json({ error: "Menu item not found." }, { status: 404 });
  }

  const conflictResult = await authResult.adminClient
    .from("menu_items")
    .select("id")
    .eq("slug", payload.slug)
    .neq("id", resolvedMenuId)
    .maybeSingle();

  if (conflictResult.data?.id) {
    return NextResponse.json({ error: "Slug is already in use." }, { status: 409 });
  }

  const updateResult = await authResult.adminClient
    .from("menu_items")
    .update(payload)
    .eq("id", resolvedMenuId)
    .select("*")
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ error: "Failed to update menu item." }, { status: 500 });
  }

  return NextResponse.json(updateResult.data);
}
