import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { userHasAdminMembership } from "@/lib/supabase/access";

function readAuthEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function isSupabaseAuthConfigured() {
  return readAuthEnv() !== null;
}

export function canBypassAuthForMockMode() {
  return !isSupabaseAuthConfigured() && process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
}

export async function getVerifiedClaims() {
  if (!isSupabaseAuthConfigured()) return null;

  const supabase = createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data,
    error,
  } = await supabase.auth.getClaims();

  if (error || !data?.claims || typeof data.claims.sub !== "string") return null;
  return data.claims;
}

export async function getAdminAccessState() {
  if (canBypassAuthForMockMode()) return null;

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { status: "unauthenticated" as const };
  }

  const {
    data,
    error,
  } = await supabase.auth.getClaims();

  if (error || !data?.claims || typeof data.claims.sub !== "string") {
    return { status: "unauthenticated" as const };
  }

  const isAdmin = await userHasAdminMembership(supabase, data.claims.sub);
  if (!isAdmin) {
    return { status: "forbidden" as const, claims: data.claims };
  }

  return { status: "admin" as const, claims: data.claims };
}

export async function requireAdminUser() {
  if (canBypassAuthForMockMode()) return null;

  const access = await getAdminAccessState();
  if (!access || access.status === "admin") {
    return access?.claims ?? null;
  }

  if (access.status === "forbidden") {
    redirect("/unauthorized");
  }

  redirect("/login");
}
