"use client";

/**
 * Browser Supabase client. Uses ONLY the public anon key — never the service
 * role key. Returns null in demo mode so client components can branch.
 */

import { createBrowserClient } from "@supabase/ssr";
import { capabilities, env } from "@/lib/config";

export function createClient() {
  if (!capabilities.hasSupabase) return null;
  return createBrowserClient(env.supabaseUrl!, env.supabaseAnonKey!);
}
