import { NextResponse } from "next/server";

import { userHasAdminMembership } from "@/lib/supabase/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function readOperatorNote(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 1000) return undefined;

  return normalized;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const orderId = id?.trim();

  if (!orderId) {
    return NextResponse.json({ error: "Missing order id." }, { status: 400 });
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

  let operatorNote: string | null | undefined;

  try {
    const body = await request.json();
    operatorNote = readOperatorNote(body?.operatorNote);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof operatorNote === "undefined") {
    return NextResponse.json({ error: "Operator note must be a string up to 1000 characters." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });
  }

  const currentOrderResult = await adminClient
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .single();

  if (currentOrderResult.error || !currentOrderResult.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const updateResult = await adminClient
    .from("orders")
    .update({ operator_note: operatorNote })
    .eq("id", orderId)
    .select("id,operator_note")
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ error: "Failed to save operator note." }, { status: 500 });
  }

  return NextResponse.json({
    id: updateResult.data.id,
    operatorNote: updateResult.data.operator_note,
  });
}
