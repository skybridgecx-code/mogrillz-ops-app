import { NextResponse } from "next/server";

import { normalizeOrderStatus } from "@/lib/dashboard/order-status";
import { requireAdminRouteContext } from "@/lib/supabase/admin-context";
import type { OrderStatus } from "@/types/domain";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type TransitionResult = {
  success?: boolean;
  error?: string;
  id?: string;
  status?: string;
  current_status?: string;
  requested_status?: string;
  existing_order_id?: string;
  existing_status?: string;
  version?: number;
  request_id?: string;
  replayed?: boolean;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readRequestedStatus(value: unknown): OrderStatus | null {
  return normalizeOrderStatus(value);
}

function readRequestId(request: Request) {
  const candidate = request.headers.get("idempotency-key")?.trim();
  return candidate && UUID_PATTERN.test(candidate) ? candidate : crypto.randomUUID();
}

function transitionFailureResponse(result: TransitionResult, requestId: string) {
  switch (result.error) {
    case "not_found":
      return NextResponse.json({ error: "Order not found.", requestId }, { status: 404 });
    case "idempotency_conflict":
      return NextResponse.json(
        {
          error: "This idempotency key was already used for a different order operation.",
          existingOrderId: result.existing_order_id,
          existingStatus: normalizeOrderStatus(result.existing_status),
          requestId,
        },
        { status: 409 },
      );
    case "conflict":
      return NextResponse.json(
        {
          error: "This order changed before your update completed. Refresh and try again.",
          currentStatus: normalizeOrderStatus(result.current_status),
          version: result.version,
          requestId,
        },
        { status: 409 },
      );
    case "invalid_transition":
      return NextResponse.json(
        {
          error: "That order status transition is no longer allowed.",
          currentStatus: normalizeOrderStatus(result.current_status),
          requestedStatus: normalizeOrderStatus(result.requested_status),
          version: result.version,
          requestId,
        },
        { status: 409 },
      );
    case "invalid_status":
      return NextResponse.json({ error: "Invalid order status.", requestId }, { status: 400 });
    case "unauthorized":
      return NextResponse.json({ error: "Unauthorized.", requestId }, { status: 401 });
    case "forbidden":
      return NextResponse.json({ error: "Forbidden.", requestId }, { status: 403 });
    default:
      return NextResponse.json(
        { error: "Failed to update order status.", requestId },
        { status: 500 },
      );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const orderId = id?.trim();
  const requestId = readRequestId(request);

  if (!orderId) {
    return NextResponse.json({ error: "Missing order id.", requestId }, { status: 400 });
  }

  if (!UUID_PATTERN.test(orderId)) {
    return NextResponse.json({ error: "Invalid order id.", requestId }, { status: 400 });
  }

  const authResult = await requireAdminRouteContext({
    request,
    contentType: "json",
  });
  if (!authResult.ok) return authResult.response;

  let requestedStatus: OrderStatus | null;

  try {
    const body = await request.json();
    requestedStatus = readRequestedStatus(body?.status);
  } catch {
    return NextResponse.json({ error: "Invalid request body.", requestId }, { status: 400 });
  }

  if (!requestedStatus) {
    return NextResponse.json({ error: "Invalid order status.", requestId }, { status: 400 });
  }

  const { data, error } = await authResult.context.supabase.rpc("transition_order_status", {
    p_order_id: orderId,
    p_next_status: requestedStatus,
    p_request_id: requestId,
  });

  if (error) {
    console.error("[api/orders/status] transition RPC failed", {
      orderId,
      requestId,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json(
      {
        error: "Order status could not be updated. Verify the operations database migration is applied.",
        requestId,
      },
      { status: 500 },
    );
  }

  const result = (data ?? {}) as TransitionResult;
  if (!result.success) {
    return transitionFailureResponse(result, requestId);
  }

  const normalizedStatus = normalizeOrderStatus(result.status);
  if (!normalizedStatus || !result.id) {
    console.error("[api/orders/status] transition returned an invalid payload", {
      orderId,
      requestId,
      result,
    });
    return NextResponse.json(
      { error: "Order status update returned an invalid result.", requestId },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: result.id,
    status: normalizedStatus,
    version: result.version,
    requestId,
    replayed: result.replayed === true,
  });
}
