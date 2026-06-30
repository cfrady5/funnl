/**
 * Server-side Supabase clients.
 *
 * - `createServerClient()` is request-scoped and reads the user's session from
 *   cookies (RLS-enforced, safe for user-facing reads/writes).
 * - `createAdminClient()` uses the service role key and BYPASSES RLS. Use it
 *   ONLY in trusted server code (e.g. writing audit snapshots). It must NEVER
 *   be imported into a client component.
 *
 * Both return null when Supabase is not configured, so callers fall back to
 * the in-memory store / demo auth.
 */

import { cookies } from "next/headers";
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { capabilities, env } from "@/lib/config";

export async function createServerClient() {
  if (!capabilities.hasSupabase) return null;
  const cookieStore = await cookies();
  return createSSRClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore; middleware refreshes.
        }
      },
    },
  });
}

/** Service-role client. SERVER ONLY. Bypasses RLS. */
export function createAdminClient() {
  if (!capabilities.hasSupabaseAdmin) return null;
  return createClient(env.supabaseUrl!, env.supabaseServiceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
