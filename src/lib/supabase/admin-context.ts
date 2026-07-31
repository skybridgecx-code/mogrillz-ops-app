import "server-only";

import { NextResponse } from "next/server";

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

export async function requireAdminRouteContext(
  options: { requireServiceRole?: boolean } = {},
): Promise<AdminContextResult> {
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
