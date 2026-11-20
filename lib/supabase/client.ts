"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";

let browserClient: SupabaseClient | undefined;

export function createSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    const { url, key } = getSupabasePublicConfig();
    browserClient = createBrowserClient(url, key, {
      cookieOptions: supabaseCookieOptions,
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return browserClient;
}
