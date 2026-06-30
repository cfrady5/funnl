/**
 * Google OAuth 2.0 (authorization code flow) shared by all Google integrations.
 *
 * Flow:
 *  1. /api/oauth/google           -> builds the consent URL, redirects user.
 *  2. Google redirects back to    -> /api/oauth/google/callback?code=...
 *  3. Callback exchanges code for  access_token + refresh_token.
 *  4. Refresh token is AES-256-GCM encrypted (lib/crypto) before storage.
 *
 * The same Google account grants all scopes; per-provider rows in
 * `google_integrations` track which scopes are active for Ads/GA4/GSC/GTM.
 */

import { env, OAUTH_REDIRECT_URI } from "@/lib/config";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string; // ISO
  scope: string;
}

export function buildConsentUrl(scopes: string[], state: string): string {
  const params = new URLSearchParams({
    client_id: env.googleClientId ?? "",
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline", // request a refresh token
    prompt: "consent", // force refresh token issuance
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId ?? "",
      client_secret: env.googleClientSecret ?? "",
      redirect_uri: OAUTH_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    scope: data.scope,
  };
}

/**
 * Exchange a (decrypted) refresh token for a fresh access token. Call this
 * server-side before each batch of API requests; access tokens live ~1 hour.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: string;
}> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.googleClientId ?? "",
      client_secret: env.googleClientSecret ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (res.status === 400 || res.status === 401) {
    // Refresh token revoked/expired — caller should mark integration expired.
    throw new Error("TOKEN_EXPIRED");
  }
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export function revokeToken(token: string): Promise<Response> {
  return fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: "POST",
  });
}
