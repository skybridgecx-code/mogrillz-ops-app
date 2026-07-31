import { NextResponse } from "next/server";

import { requireAdminRouteContext } from "@/lib/supabase/admin-context";

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

  const authResult = await requireAdminRouteContext({
    request,
    contentType: "json",
  });
  if (!authResult.ok) return authResult.response;

  let operatorNote: string | null | undefined;

  try {
    const body = await request.json();
    operatorNote = readOperatorNote(body?.operatorNote);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof operatorNote === "undefined") {
    return NextResponse.json(
      { error: "Operator note must be a string up to 1000 characters." },
      { status: 400 },
    );
  }

  const updateResult = await authResult.context.supabase
    .from("orders")
    .update({ operator_note: operatorNote })
    .eq("id", orderId)
    .select("id,operator_note")
    .maybeSingle();

  if (updateResult.error) {
    console.error("[api/orders/note] update failed", {
      orderId,
      code: updateResult.error.code,
      message: updateResult.error.message,
    });
    return NextResponse.json({ error: "Failed to save operator note." }, { status: 500 });
  }

  if (!updateResult.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({
    id: updateResult.data.id,
    operatorNote: updateResult.data.operator_note,
  });
}
