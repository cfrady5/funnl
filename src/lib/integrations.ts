/**
 * Integration + selected-account state.
 *
 * Tracks which Google providers a user has connected and which accounts they
 * selected. Storage is layered:
 *
 *   1. Supabase (`google_integrations`, `selected_google_accounts`) when
 *      configured — durable across serverless instances, which is what makes
 *      connected audits work in production. Refresh tokens are AES-256-GCM
 *      encrypted (lib/crypto) BEFORE they reach this module.
 *   2. A process-global in-memory map — cache in front of Supabase, and the
 *      whole store for local dev without a database.
 *
 * All read/write functions are async so callers never care which layer served
 * the data.
 */

import { capabilities } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/server";
import { generateId } from "@/lib/utils";
import type {
  GoogleIntegration,
  IntegrationProvider,
  SelectedGoogleAccounts,
} from "@/lib/types";

interface TokenRecord {
  accessToken?: string;
  refreshTokenEncrypted?: string;
  expiresAt?: string;
}

interface IntegrationStore {
  integrations: Map<string, GoogleIntegration>; // key: `${userId}:${provider}`
  selections: Map<string, SelectedGoogleAccounts>; // key: userId
  // Tokens kept separate so they are never trivially returned to the UI.
  tokens: Map<string, TokenRecord>;
}

const g = globalThis as unknown as { __semIntegrations?: IntegrationStore };
const store: IntegrationStore =
  g.__semIntegrations ??
  (g.__semIntegrations = {
    integrations: new Map(),
    selections: new Map(),
    tokens: new Map(),
  });

const PROVIDERS: IntegrationProvider[] = ["google_ads", "ga4", "search_console", "gtm"];

const PROVIDER_LABEL: Record<IntegrationProvider, string> = {
  google_ads: "Google Ads",
  ga4: "Google Analytics 4",
  search_console: "Search Console",
  gtm: "Google Tag Manager",
};

export function providerLabel(p: IntegrationProvider): string {
  return PROVIDER_LABEL[p];
}

// --- Integrations -----------------------------------------------------------

export async function listIntegrations(userId: string): Promise<GoogleIntegration[]> {
  await hydrateIntegrations(userId);
  return PROVIDERS.map((provider) => {
    const existing = store.integrations.get(`${userId}:${provider}`);
    if (existing) return existing;
    return {
      id: `${userId}:${provider}`,
      userId,
      provider,
      scopes: [],
      connectedAt: null,
      lastSyncAt: null,
      status: "disconnected" as const,
    };
  });
}

export async function connectProvider(
  userId: string,
  provider: IntegrationProvider,
  scopes: string[],
  tokens?: { accessToken: string; refreshTokenEncrypted: string | null; expiresAt: string },
): Promise<GoogleIntegration> {
  const integration: GoogleIntegration = {
    id: `${userId}:${provider}`,
    userId,
    provider,
    scopes,
    connectedAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
    status: "connected",
    tokenExpiresAt: tokens?.expiresAt ?? null,
  };
  store.integrations.set(integration.id, integration);
  if (tokens) {
    store.tokens.set(`${userId}:${provider}`, {
      accessToken: tokens.accessToken,
      refreshTokenEncrypted: tokens.refreshTokenEncrypted ?? undefined,
      expiresAt: tokens.expiresAt,
    });
  }
  await persistIntegration(integration);
  return integration;
}

export async function disconnectProvider(
  userId: string,
  provider: IntegrationProvider,
): Promise<void> {
  store.integrations.delete(`${userId}:${provider}`);
  store.tokens.delete(`${userId}:${provider}`);
  const admin = createAdminClient();
  if (!admin) return;
  try {
    await admin
      .from("google_integrations")
      .delete()
      .eq("user_id", userId)
      .eq("provider", provider);
  } catch (err) {
    console.error("disconnectProvider: Supabase delete failed:", err);
  }
}

export async function syncProvider(userId: string, provider: IntegrationProvider): Promise<void> {
  const existing = store.integrations.get(`${userId}:${provider}`);
  const now = new Date().toISOString();
  if (existing) {
    existing.lastSyncAt = now;
    store.integrations.set(existing.id, existing);
  }
  const admin = createAdminClient();
  if (!admin) return;
  try {
    await admin
      .from("google_integrations")
      .update({ last_sync_at: now })
      .eq("user_id", userId)
      .eq("provider", provider);
  } catch (err) {
    console.error("syncProvider: Supabase update failed:", err);
  }
}

/**
 * Returns the stored token record for a provider. Memory first; falls back to
 * the encrypted refresh token persisted in Supabase (the access token is
 * short-lived and re-minted from the refresh token, so losing it is fine).
 */
export async function getTokens(
  userId: string,
  provider: IntegrationProvider,
): Promise<TokenRecord | null> {
  const cached = store.tokens.get(`${userId}:${provider}`);
  if (cached?.refreshTokenEncrypted) return cached;
  const admin = createAdminClient();
  if (!admin) return cached ?? null;
  try {
    const { data } = await admin
      .from("google_integrations")
      .select("refresh_token_encrypted, token_expires_at")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();
    if (!data?.refresh_token_encrypted) return cached ?? null;
    const record: TokenRecord = {
      refreshTokenEncrypted: data.refresh_token_encrypted as string,
      expiresAt: (data.token_expires_at as string | null) ?? undefined,
    };
    store.tokens.set(`${userId}:${provider}`, record);
    return record;
  } catch {
    return cached ?? null;
  }
}

// --- Selected accounts -------------------------------------------------------

export async function getSelections(userId: string): Promise<SelectedGoogleAccounts | null> {
  const cached = store.selections.get(userId);
  if (cached) return cached;
  const admin = createAdminClient();
  if (!admin) return null;
  try {
    const { data } = await admin
      .from("selected_google_accounts")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const sel: SelectedGoogleAccounts = {
      id: data.id,
      userId,
      businessId: data.business_id ?? "default",
      googleAdsCustomerId: data.google_ads_customer_id,
      ga4PropertyId: data.ga4_property_id,
      searchConsoleSiteUrl: data.search_console_site_url,
      gtmAccountId: data.gtm_account_id,
      gtmContainerId: data.gtm_container_id,
      gtmWorkspaceId: data.gtm_workspace_id,
    };
    store.selections.set(userId, sel);
    return sel;
  } catch {
    return null;
  }
}

export async function saveSelections(
  userId: string,
  businessId: string,
  partial: Partial<Omit<SelectedGoogleAccounts, "id" | "userId" | "businessId">>,
): Promise<SelectedGoogleAccounts> {
  const existing = store.selections.get(userId);
  const next: SelectedGoogleAccounts = {
    id: existing?.id ?? generateId("sel"),
    userId,
    businessId,
    googleAdsCustomerId: existing?.googleAdsCustomerId ?? null,
    ga4PropertyId: existing?.ga4PropertyId ?? null,
    searchConsoleSiteUrl: existing?.searchConsoleSiteUrl ?? null,
    gtmAccountId: existing?.gtmAccountId ?? null,
    gtmContainerId: existing?.gtmContainerId ?? null,
    gtmWorkspaceId: existing?.gtmWorkspaceId ?? null,
    ...partial,
  };
  store.selections.set(userId, next);
  const admin = createAdminClient();
  if (admin) {
    try {
      // Keyed on user_id (single active selection set per user in the MVP).
      await admin.from("selected_google_accounts").upsert(
        {
          user_id: userId,
          business_id: null, // transient business ids aren't FK-valid; null is fine
          google_ads_customer_id: next.googleAdsCustomerId,
          ga4_property_id: next.ga4PropertyId,
          search_console_site_url: next.searchConsoleSiteUrl,
          gtm_account_id: next.gtmAccountId,
          gtm_container_id: next.gtmContainerId,
          gtm_workspace_id: next.gtmWorkspaceId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,business_id" },
      );
    } catch (err) {
      console.error("saveSelections: Supabase upsert failed (kept in memory):", err);
    }
  }
  return next;
}

// --- Internals ---------------------------------------------------------------

/** Pull the user's integration rows from Supabase into the in-memory cache. */
async function hydrateIntegrations(userId: string): Promise<void> {
  if (!capabilities.hasSupabaseAdmin) return;
  // Cheap staleness guard: if we already have any row for this user, trust it
  // for the life of this instance (writes update both layers).
  for (const p of PROVIDERS) {
    if (store.integrations.has(`${userId}:${p}`)) return;
  }
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const { data } = await admin
      .from("google_integrations")
      .select("provider, scopes, connected_at, last_sync_at, status, token_expires_at")
      .eq("user_id", userId);
    for (const row of data ?? []) {
      const provider = row.provider as IntegrationProvider;
      if (!PROVIDERS.includes(provider)) continue;
      store.integrations.set(`${userId}:${provider}`, {
        id: `${userId}:${provider}`,
        userId,
        provider,
        scopes: (row.scopes as string[]) ?? [],
        connectedAt: row.connected_at,
        lastSyncAt: row.last_sync_at,
        status: (row.status as GoogleIntegration["status"]) ?? "connected",
        tokenExpiresAt: row.token_expires_at,
      });
    }
  } catch (err) {
    console.error("hydrateIntegrations failed (memory only):", err);
  }
}

async function persistIntegration(integration: GoogleIntegration): Promise<void> {
  if (!capabilities.hasSupabaseAdmin) return;
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const tokens = store.tokens.get(`${integration.userId}:${integration.provider}`);
    await admin.from("google_integrations").upsert(
      {
        user_id: integration.userId,
        provider: integration.provider,
        // Refresh token is already encrypted before reaching here.
        refresh_token_encrypted: tokens?.refreshTokenEncrypted ?? null,
        token_expires_at: integration.tokenExpiresAt ?? null,
        scopes: integration.scopes,
        connected_at: integration.connectedAt,
        last_sync_at: integration.lastSyncAt,
        status: integration.status,
      },
      { onConflict: "user_id,provider" },
    );
  } catch (err) {
    console.error("persistIntegration failed (kept in memory):", err);
  }
}
