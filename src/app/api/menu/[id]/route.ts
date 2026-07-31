import { NextResponse } from "next/server";

import {
  requireAdminRouteContext,
  type AdminRouteContext,
} from "@/lib/supabase/admin-context";

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
  is_active: boolean;
  notes: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

function readOptionalInteger(value: unknown, min: number, max: number, field: string) {
  if (value == null || value === "") return null;

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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function readText(value: unknown, maxLength: number, field: string) {
  if (typeof value !== "string") throw new Error(`${field} is required.`);

  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required.`);
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
  if (typeof value !== "string") throw new Error("Availability is required.");

  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ");
  const legacyMap: Record<string, (typeof MENU_AVAILABILITY_VALUES)[number]> = {
    active: "Live",
    available: "Live",
    enabled: "Live",
    true: "Live",
    draft: "Watch",
    pending: "Watch",
    pause: "Paused",
    inactive: "Paused",
    disabled: "Paused",
    false: "Paused",
    soldout: "Sold Out",
    out: "Sold Out",
    unavailable: "Sold Out",
  };

  const legacyMatch = legacyMap[normalized];
  if (legacyMatch) return legacyMatch.toLowerCase();

  const match = MENU_AVAILABILITY_VALUES.find(
    (option) => option.toLowerCase() === normalized,
  );
  if (!match) throw new Error("Availability is invalid.");

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
  if (typeof value !== "boolean") throw new Error(`${field} must be true or false.`);
  return value;
}

function readMenuPayload(body: unknown): MenuPayload {
  const data = (body ?? {}) as Record<string, unknown>;
  const name = readText(data.name, 120, "Name");
  const slug = slugify(typeof data.slug === "string" ? data.slug : name);

  if (!slug) throw new Error("Slug is required.");

  const availability = readAvailability(data.availability);
  return {
    slug,
    name,
    category: readText(data.category, 60, "Category"),
    price_cents: readInteger(data.priceCents, 0, 100000, "Price"),
    availability,
    is_active: availability === "live",
    allocation_limit: readInteger(data.allocationLimit, 0, 100, "Allocation limit"),
    description: readText(data.description, 500, "Description"),
    image_url: readOptionalText(data.imageUrl, 2048),
    sort_order: readInteger(data.sortOrder ?? 0, 0, 100000, "Sort order"),
    is_featured: readBoolean(data.isFeatured, "Featured flag"),
    notes: readOptionalText(data.notes, 400),
    calories: readOptionalInteger(data.calories, 0, 5000, "Calories"),
    protein_g: readOptionalInteger(data.proteinG, 0, 500, "Protein"),
    carbs_g: readOptionalInteger(data.carbsG, 0, 500, "Carbs"),
    fat_g: readOptionalInteger(data.fatG, 0, 500, "Fat"),
  };
}

async function resolveMenuId(client: AdminRouteContext["supabase"], key: string) {
  const bySlug = await client.from("menu_items").select("id").eq("slug", key).maybeSingle();
  if (bySlug.error) return null;
  if (bySlug.data?.id) return bySlug.data.id as string;

  const byId = await client.from("menu_items").select("id").eq("id", key).maybeSingle();
  if (byId.error) return null;
  if (byId.data?.id) return byId.data.id as string;

  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const menuKey = id?.trim();

  if (!menuKey) {
    return NextResponse.json({ error: "Missing menu item id." }, { status: 400 });
  }

  const authResult = await requireAdminRouteContext({
    request,
    contentType: "json",
  });
  if (!authResult.ok) return authResult.response;

  let payload: MenuPayload;

  try {
    payload = readMenuPayload(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const client = authResult.context.supabase;
  const resolvedMenuId = await resolveMenuId(client, menuKey);
  if (!resolvedMenuId) {
    return NextResponse.json({ error: "Menu item not found." }, { status: 404 });
  }

  const conflictResult = await client
    .from("menu_items")
    .select("id")
    .eq("slug", payload.slug)
    .neq("id", resolvedMenuId)
    .maybeSingle();

  if (conflictResult.error) {
    console.error("[api/menu/[id]] slug conflict check failed", {
      menuKey,
      code: conflictResult.error.code,
      message: conflictResult.error.message,
    });
    return NextResponse.json({ error: "Failed to validate the menu item slug." }, { status: 500 });
  }

  if (conflictResult.data?.id) {
    return NextResponse.json({ error: "Slug is already in use." }, { status: 409 });
  }

  const updateResult = await client
    .from("menu_items")
    .update(payload)
    .eq("id", resolvedMenuId)
    .select("*")
    .single();

  if (updateResult.error || !updateResult.data) {
    console.error("[api/menu/[id]] update failed", {
      menuKey,
      code: updateResult.error?.code,
      message: updateResult.error?.message,
    });
    return NextResponse.json({ error: "Failed to update menu item." }, { status: 500 });
  }

  return NextResponse.json(updateResult.data);
}
