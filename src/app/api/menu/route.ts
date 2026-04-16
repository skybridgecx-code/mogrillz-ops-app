import { NextResponse } from "next/server";

import { userHasAdminMembership } from "@/lib/supabase/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const match = MENU_AVAILABILITY_VALUES.find(
    (option) => option.toLowerCase() === value.trim().toLowerCase(),
  );
  if (!match) throw new Error("Availability is invalid.");
  return match.toLowerCase();
}

function readBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new Error(`${field} must be true or false.`);
  return value;
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

    const createResult = await authResult.adminClient
      .from("menu_items")
      .insert({
        slug,
        name,
        category: readText(payload.category, 60, "Category"),
        price_cents: readInteger(payload.priceCents, 0, 100000, "Price"),
        availability: readAvailability(payload.availability),
        allocation_limit: readInteger(payload.allocationLimit, 0, 100, "Allocation limit"),
        description: readText(payload.description, 500, "Description"),
        image_url: readOptionalText(payload.imageUrl, 500),
        sort_order: readInteger(payload.sortOrder ?? 0, 0, 100000, "Sort order"),
        is_featured: readBoolean(payload.isFeatured, "Featured flag"),
        notes: readOptionalText(payload.notes, 400),
      })
      .select("*")
      .single();

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
