import { NextResponse } from "next/server";

import { requireAdminRouteContext } from "@/lib/supabase/admin-context";

const MENU_AVAILABILITY_VALUES = ["Live", "Watch", "Paused", "Sold Out"] as const;

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
  if (typeof value !== "string") throw new Error("Optional text fields must be strings.");
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new Error(`Optional text fields must be ${maxLength} characters or fewer.`);
  }
  return normalized;
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

function readBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new Error(`${field} must be true or false.`);
  return value;
}

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

export async function POST(request: Request) {
  const authResult = await requireAdminRouteContext({
    request,
    contentType: "json",
  });
  if (!authResult.ok) return authResult.response;

  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const name = readText(payload.name, 120, "Name");
    const slug = slugify(typeof payload.slug === "string" ? payload.slug : name);

    if (!slug) throw new Error("Slug is required.");

    const availability = readAvailability(payload.availability);
    const insertPayload = {
      slug,
      name,
      category: readText(payload.category, 60, "Category"),
      price_cents: readInteger(payload.priceCents, 0, 100000, "Price"),
      availability,
      is_active: availability === "live",
      allocation_limit: readInteger(payload.allocationLimit, 0, 100, "Allocation limit"),
      description: readText(payload.description, 500, "Description"),
      image_url: readOptionalText(payload.imageUrl, 2048),
      sort_order: readInteger(payload.sortOrder ?? 0, 0, 100000, "Sort order"),
      is_featured: readBoolean(payload.isFeatured, "Featured flag"),
      notes: readOptionalText(payload.notes, 400),
      calories: readOptionalInteger(payload.calories, 0, 5000, "Calories"),
      protein_g: readOptionalInteger(payload.proteinG, 0, 500, "Protein"),
      carbs_g: readOptionalInteger(payload.carbsG, 0, 500, "Carbs"),
      fat_g: readOptionalInteger(payload.fatG, 0, 500, "Fat"),
    };

    const createResult = await authResult.context.supabase
      .from("menu_items")
      .insert(insertPayload)
      .select("*")
      .single();

    if (createResult.error || !createResult.data) {
      const isDuplicate = createResult.error?.code === "23505";
      if (!isDuplicate) {
        console.error("[api/menu] create failed", {
          code: createResult.error?.code,
          message: createResult.error?.message,
        });
      }
      return NextResponse.json(
        { error: isDuplicate ? "Slug is already in use." : "Failed to create menu item." },
        { status: isDuplicate ? 409 : 500 },
      );
    }

    return NextResponse.json(createResult.data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
