/**
 * Authentication helper.
 *
 * - Supabase configured: reads the real authenticated user from the session.
 * - Demo mode: returns a stable demo user so the whole app is usable without
 *   any auth provider. This keeps the acceptance criterion "I can use demo
 *   mode" true out of the box.
 *
 * Route protection is handled in middleware.ts; this is the server-side
 * accessor used by pages/actions that need the current user.
 */

import { DEMO_MODE } from "@/lib/config";
import { createServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const DEMO_USER: Profile = {
  id: "demo_user",
  email: "demo@semcommandcenter.app",
  name: "Demo User",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

export async function getCurrentUser(): Promise<Profile | null> {
  if (DEMO_MODE) return DEMO_USER;
  const supabase = await createServerClient();
  if (!supabase) return DEMO_USER;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    name: (user.user_metadata?.name as string) ?? user.email?.split("@")[0] ?? null,
    createdAt: user.created_at ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function requireUser(): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) {
    // In practice middleware redirects first; this is a safety net.
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}
