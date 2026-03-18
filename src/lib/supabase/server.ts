import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type SupabaseServerEnv = {
  url: string;
  publishableKey: string;
};

function readServerEnv(): SupabaseServerEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !publishableKey) return null;

  return { url, publishableKey };
}

export function createSupabaseServerClient() {
  const env = readServerEnv();
  if (!env) return null;

  const cookieStore = cookies();

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      async getAll() {
        return (await cookieStore).getAll();
      },
      async setAll(cookiesToSet) {
        const cookieJar = await cookieStore;

        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieJar.set(name, value, options);
          } catch {
            // Ignore cookie writes when the current rendering context disallows them.
          }
        }
      },
    },
  });
}

export const createClient = createSupabaseServerClient;
