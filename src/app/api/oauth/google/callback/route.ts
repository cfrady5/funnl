import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import { maybeEncrypt } from "@/lib/crypto";
import { connectProvider } from "@/lib/integrations";
import { providersForScopes } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";

/**
 * OAuth callback. Validates state (CSRF), exchanges the code for tokens,
 * encrypts the refresh token, and records a connected integration row for each
 * provider the granted scopes unlock.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("g_oauth_state")?.value;
  cookieStore.delete("g_oauth_state");
  cookieStore.delete("g_oauth_provider");

  if (error) {
    return NextResponse.redirect(new URL(`/integrations?error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/integrations?error=invalid_state", req.url));
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const tokens = await exchangeCodeForTokens(code);
    const providers = providersForScopes(tokens.scope);
    const refreshTokenEncrypted = maybeEncrypt(tokens.refreshToken);

    for (const provider of providers) {
      connectProvider(user.id, provider, tokens.scope.split(" "), {
        accessToken: tokens.accessToken,
        refreshTokenEncrypted,
        expiresAt: tokens.expiresAt,
      });
    }

    return NextResponse.redirect(new URL("/integrations?connected=1", req.url));
  } catch (err) {
    console.error("OAuth callback failed:", err);
    return NextResponse.redirect(new URL("/integrations?error=token_exchange", req.url));
  }
}
