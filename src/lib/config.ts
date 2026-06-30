/**
 * Central runtime configuration + capability detection.
 *
 * The app is designed to run in three escalating tiers without code changes:
 *  1. Demo mode      — no env vars at all. In-memory store, demo auth, sample data.
 *  2. Persisted mode — Supabase configured. Real auth + database, demo Google data.
 *  3. Connected mode — Supabase + Google configured. Live Ads/GA4/GSC/GTM pulls.
 *
 * Every integration checks the relevant `has*` flag and degrades gracefully.
 */

function val(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export const env = {
  supabaseUrl: val("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: val("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: val("SUPABASE_SERVICE_ROLE_KEY"),
  authSecret: val("AUTH_SECRET"),
  googleClientId: val("GOOGLE_CLIENT_ID"),
  googleClientSecret: val("GOOGLE_CLIENT_SECRET"),
  googleAdsDeveloperToken: val("GOOGLE_ADS_DEVELOPER_TOKEN"),
  googleAdsLoginCustomerId: val("GOOGLE_ADS_LOGIN_CUSTOMER_ID"),
  encryptionKey: val("ENCRYPTION_KEY"),
  pageSpeedApiKey: val("PAGESPEED_API_KEY"),
  aiApiKey: val("AI_API_KEY"),
  aiModel: val("AI_MODEL") ?? "claude-opus-4-8",
  appUrl: val("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
} as const;

export const capabilities = {
  /** True when Supabase is wired up for real persistence + auth. */
  hasSupabase: Boolean(env.supabaseUrl && env.supabaseAnonKey),
  hasSupabaseAdmin: Boolean(env.supabaseUrl && env.supabaseServiceKey),
  /** True when Google OAuth is configured (enables real Connect flow). */
  hasGoogleOAuth: Boolean(env.googleClientId && env.googleClientSecret),
  hasGoogleAds: Boolean(
    env.googleClientId && env.googleClientSecret && env.googleAdsDeveloperToken,
  ),
  hasPageSpeed: Boolean(env.pageSpeedApiKey),
  hasAI: Boolean(env.aiApiKey),
  hasEncryptionKey: Boolean(env.encryptionKey),
} as const;

/** When true, the whole app behaves as a self-contained demo (no external deps). */
export const DEMO_MODE = !capabilities.hasSupabase;

export const OAUTH_REDIRECT_URI = `${env.appUrl}/api/oauth/google/callback`;

/** OAuth scopes requested for each Google integration. */
export const GOOGLE_SCOPES = {
  base: ["openid", "email", "profile"],
  ads: ["https://www.googleapis.com/auth/adwords"],
  ga4: ["https://www.googleapis.com/auth/analytics.readonly"],
  searchConsole: ["https://www.googleapis.com/auth/webmasters.readonly"],
  gtm: ["https://www.googleapis.com/auth/tagmanager.readonly"],
} as const;

export function allGoogleScopes(): string[] {
  return [
    ...GOOGLE_SCOPES.base,
    ...GOOGLE_SCOPES.ads,
    ...GOOGLE_SCOPES.ga4,
    ...GOOGLE_SCOPES.searchConsole,
    ...GOOGLE_SCOPES.gtm,
  ];
}

/** Scopes to request for a given provider connect button ("all" = everything). */
export function allGoogleScopesForProvider(provider: string): string[] {
  switch (provider) {
    case "google_ads":
      return [...GOOGLE_SCOPES.base, ...GOOGLE_SCOPES.ads];
    case "ga4":
      return [...GOOGLE_SCOPES.base, ...GOOGLE_SCOPES.ga4];
    case "search_console":
      return [...GOOGLE_SCOPES.base, ...GOOGLE_SCOPES.searchConsole];
    case "gtm":
      return [...GOOGLE_SCOPES.base, ...GOOGLE_SCOPES.gtm];
    default:
      return allGoogleScopes();
  }
}

/** Map a granted scope string to the providers it unlocks. */
export function providersForScopes(scope: string): IntegrationProviderName[] {
  const out: IntegrationProviderName[] = [];
  if (scope.includes("adwords")) out.push("google_ads");
  if (scope.includes("analytics")) out.push("ga4");
  if (scope.includes("webmasters")) out.push("search_console");
  if (scope.includes("tagmanager")) out.push("gtm");
  return out;
}

type IntegrationProviderName = "google_ads" | "ga4" | "search_console" | "gtm";
