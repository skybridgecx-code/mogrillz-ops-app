import { NextResponse } from "next/server";

import { userHasAdminMembership } from "@/lib/supabase/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MENU_AVAILABILITY_VALUES = ["Live", "Watch", "Paused", "Sold Out"] as const;
const MACRO_COLUMNS = ["calories", "protein_g", "carbs_g", "fat_g"] as const;
const OPTIONAL_MENU_COLUMNS = [...MACRO_COLUMNS, "is_active"] as const;

function isMissingOptionalMenuColumn(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    OPTIONAL_MENU_COLUMNS.some((column) => message.includes(column))
  );
}

function stripOptionalMenuColumns<T extends Record<string, unknown>>(payload: T) {
  const next = { ...payload };
  for (const column of OPTIONAL_MENU_COLUMNS) {
    delete next[column];
  }
  return next;
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
  if (normalized.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  return normalized;
}

function readOptionalText(value: unknown, maxLength: number) {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("Optional text fields must be strings.");
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new Error(`Optional text fields must be ${maxLength} characters or fewer.`);
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

export async function POST(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let slug: string;

  try {
    const name = readText(payload.name, 120, "Name");
    slug = slugify(typeof payload.slug === "string" ? payload.slug : name);

    if (!slug) {
      throw new Error("Slug is required.");
    }

    const availability = readAvailability(payload.availability);
    const insertPayload: Record<string, unknown> = {
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
    };

    // Macros are optional and only written when provided, so item creation
    // keeps working before the meal-prep migration has been applied.
    const calories = readOptionalInteger(payload.calories, 0, 5000, "Calories");
    const proteinG = readOptionalInteger(payload.proteinG, 0, 500, "Protein");
    const carbsG = readOptionalInteger(payload.carbsG, 0, 500, "Carbs");
    const fatG = readOptionalInteger(payload.fatG, 0, 500, "Fat");

    if (calories !== null || proteinG !== null || carbsG !== null || fatG !== null) {
      insertPayload.calories = calories;
      insertPayload.protein_g = proteinG;
      insertPayload.carbs_g = carbsG;
      insertPayload.fat_g = fatG;
    }

    let createResult = await authResult.adminClient
      .from("menu_items")
      .insert(insertPayload)
      .select("*")
      .single();

    if (createResult.error && isMissingOptionalMenuColumn(createResult.error)) {
      createResult = await authResult.adminClient
        .from("menu_items")
        .insert(stripOptionalMenuColumns(insertPayload))
        .select("*")
        .single();
    }

    if (createResult.error || !createResult.data) {
      const message =
        createResult.error?.code === "23505" ? "Slug is already in use." : "Failed to create menu item.";
      return NextResponse.json({ error: message }, { status: createResult.error?.code === "23505" ? 409 : 500 });
    }

    return NextResponse.json(createResult.data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
