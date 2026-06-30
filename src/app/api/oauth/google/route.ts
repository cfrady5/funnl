import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildConsentUrl } from "@/lib/google/oauth";
import { capabilities, allGoogleScopesForProvider } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";

/**
 * Starts the Google OAuth consent flow. `?provider=` selects which scopes to
 * request (defaults to all). We store a short-lived state token in a cookie to
 * mitigate CSRF on the callback.
 */
export async function GET(req: Request) {
  if (!capabilities.hasGoogleOAuth) {
    // Demo mode: there's nothing to authorize. Bounce back with a notice.
    return NextResponse.redirect(new URL("/integrations?demo=1", req.url));
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") ?? "all";

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  cookieStore.set("g_oauth_provider", provider, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const scopes = allGoogleScopesForProvider(provider);
  return NextResponse.redirect(buildConsentUrl(scopes, state));
}
