import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { userHasAdminMembership } from "@/lib/supabase/access";

function readEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export async function updateSession(request: NextRequest) {
  const env = readEnv();
  const pathname = request.nextUrl.pathname;
  const canBypassForMockMode = !env && process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

  if (!env) {
    if (!canBypassForMockMode && pathname !== "/login") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("next", pathname);

      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const claimsResult = await supabase.auth.getClaims();
  const claims = claimsResult.data?.claims;

  if (!claims && pathname !== "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (claims?.sub) {
    const isAdmin = await userHasAdminMembership(supabase, claims.sub);

    if (!isAdmin && pathname !== "/unauthorized") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/unauthorized";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (claims && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export function createSupabaseMiddlewareClient(request: NextRequest, response: NextResponse) {
  const env = readEnv();
  if (!env) return null;

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
