import "server-only";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

type SupabaseAdminEnv = {
  url: string;
  serviceRoleKey: string;
};

function readAdminEnv(): SupabaseAdminEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) return null;

  return { url, serviceRoleKey };
}

export function createSupabaseAdminClient() {
  const env = readAdminEnv();
  if (!env) return null;

  return createSupabaseJsClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export const createClient = createSupabaseAdminClient;
