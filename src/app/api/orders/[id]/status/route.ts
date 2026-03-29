import { NextResponse } from "next/server";

import {
  getNextOrderStatus,
  isValidForwardOrderStatusTransition,
  normalizeOrderStatus,
} from "@/lib/dashboard/order-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { userHasAdminMembership } from "@/lib/supabase/access";
import type { OrderStatus } from "@/types/domain";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function readRequestedStatus(value: unknown): OrderStatus | null {
  return normalizeOrderStatus(value);
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

  let requestedStatus: OrderStatus | null;

  try {
    const body = await request.json();
    requestedStatus = readRequestedStatus(body?.status);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!requestedStatus) {
    return NextResponse.json({ error: "Invalid order status." }, { status: 400 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 500 });
  }

  const currentOrderResult = await adminClient
    .from("orders")
    .select("id,status")
    .eq("id", orderId)
    .single();

  if (currentOrderResult.error || !currentOrderResult.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const currentStatus = normalizeOrderStatus(currentOrderResult.data.status);
  if (!currentStatus) {
    return NextResponse.json({ error: "Order has an unsupported status." }, { status: 400 });
  }

  const nextAllowedStatus = getNextOrderStatus(currentStatus);
  if (!nextAllowedStatus || !isValidForwardOrderStatusTransition(currentStatus, requestedStatus)) {
    return NextResponse.json(
      {
        error: nextAllowedStatus
          ? `Only ${currentStatus} -> ${nextAllowedStatus} is allowed.`
          : "No further status transition is allowed.",
      },
      { status: 400 },
    );
  }

  const updateResult = await adminClient
    .from("orders")
    .update({ status: requestedStatus })
    .eq("id", orderId)
    .select("id,status")
    .single();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ error: "Failed to update order status." }, { status: 500 });
  }

  return NextResponse.json({
    id: updateResult.data.id,
    status: updateResult.data.status,
  });
}
