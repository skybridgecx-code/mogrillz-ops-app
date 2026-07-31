import "server-only";

import { NextResponse } from "next/server";

import {
  validateMutationRequest,
  type MutationContentType,
} from "@/lib/http/mutation-request";
import { userHasAdminMembership } from "@/lib/supabase/access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = NonNullable<ReturnType<typeof createSupabaseServerClient>>;
type SupabaseAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export type AdminRouteContext = {
  userId: string;
  supabase: SupabaseServerClient;
  adminClient: SupabaseAdminClient | null;
};

type AdminContextResult =
  | { ok: true; context: AdminRouteContext }
  | { ok: false; response: NextResponse };

type AdminContextOptions = {
  request: Request;
  contentType: MutationContentType;
  requireServiceRole?: boolean;
};

export async function requireAdminRouteContext(
  options: AdminContextOptions,
): Promise<AdminContextResult> {
  const requestValidation = validateMutationRequest(options.request, options.contentType);
  if (!requestValidation.ok) {
    const status = requestValidation.reason === "content-type" ? 415 : 403;
    const error =
      requestValidation.reason === "content-type"
        ? "Unsupported request content type."
        : "Cross-origin mutation requests are forbidden.";

    return {
      ok: false,
      response: NextResponse.json({ error }, { status }),
    };
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Supabase is not configured." }, { status: 500 }),
    };
  }

  const claimsResult = await supabase.auth.getClaims();
  const userId =
    typeof claimsResult.data?.claims?.sub === "string" ? claimsResult.data.claims.sub : null;

  if (claimsResult.error || !userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const isAdmin = await userHasAdminMembership(supabase, userId);
  if (!isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  const adminClient = options.requireServiceRole ? createSupabaseAdminClient() : null;
  if (options.requireServiceRole && !adminClient) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Supabase privileged operations are not configured." },
        { status: 500 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      userId,
      supabase,
      adminClient,
    },
  };
}
