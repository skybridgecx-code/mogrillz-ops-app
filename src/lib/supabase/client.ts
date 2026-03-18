import { createBrowserClient } from "@supabase/ssr";

type SupabaseBrowserEnv = {
  url: string;
  publishableKey: string;
};

function readBrowserEnv(): SupabaseBrowserEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !publishableKey) return null;

  return { url, publishableKey };
}

export function isSupabaseBrowserConfigured() {
  return readBrowserEnv() !== null;
}

export function createSupabaseBrowserClient() {
  const env = readBrowserEnv();
  if (!env) return null;

  return createBrowserClient(env.url, env.publishableKey);
}

export const createClient = createSupabaseBrowserClient;
