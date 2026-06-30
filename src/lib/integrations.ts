/**
 * Integration + selected-account state.
 *
 * Tracks which Google providers a user has connected and which accounts they
 * selected. In demo mode this is seeded so the Integrations page is populated
 * and connected audits work end-to-end. With Supabase configured, records are
 * persisted to `google_integrations` + `selected_google_accounts` (tokens
 * encrypted — see lib/crypto).
 */

import { capabilities } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/server";
import { generateId } from "@/lib/utils";
import type {
  GoogleIntegration,
  IntegrationProvider,
  SelectedGoogleAccounts,
} from "@/lib/types";

interface IntegrationStore {
  integrations: Map<string, GoogleIntegration>; // key: `${userId}:${provider}`
  selections: Map<string, SelectedGoogleAccounts>; // key: userId
  // Encrypted tokens kept separate so they're never trivially returned to UI.
  tokens: Map<string, { accessToken?: string; refreshTokenEncrypted?: string; expiresAt?: string }>;
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

export function listIntegrations(userId: string): GoogleIntegration[] {
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

export function connectProvider(
  userId: string,
  provider: IntegrationProvider,
  scopes: string[],
  tokens?: { accessToken: string; refreshTokenEncrypted: string | null; expiresAt: string },
): GoogleIntegration {
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
  void persistIntegration(integration);
  return integration;
}

export function disconnectProvider(userId: string, provider: IntegrationProvider): void {
  store.integrations.delete(`${userId}:${provider}`);
  store.tokens.delete(`${userId}:${provider}`);
}

export function syncProvider(userId: string, provider: IntegrationProvider): void {
  const existing = store.integrations.get(`${userId}:${provider}`);
  if (existing) {
    existing.lastSyncAt = new Date().toISOString();
    store.integrations.set(existing.id, existing);
  }
}

export function getSelections(userId: string): SelectedGoogleAccounts | null {
  return store.selections.get(userId) ?? null;
}

export function saveSelections(
  userId: string,
  businessId: string,
  partial: Partial<Omit<SelectedGoogleAccounts, "id" | "userId" | "businessId">>,
): SelectedGoogleAccounts {
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
  return next;
}

/** Seed the demo user with all four providers connected + accounts selected. */
export function ensureDemoIntegrations(userId: string): void {
  if (store.integrations.has(`${userId}:google_ads`)) return;
  for (const p of PROVIDERS) {
    store.integrations.set(`${userId}:${p}`, {
      id: `${userId}:${p}`,
      userId,
      provider: p,
      scopes: ["demo"],
      connectedAt: "2026-06-01T12:00:00.000Z",
      lastSyncAt: "2026-06-29T08:30:00.000Z",
      status: "connected",
    });
  }
  store.selections.set(userId, {
    id: generateId("sel"),
    userId,
    businessId: "demo_business",
    googleAdsCustomerId: "123-456-7890",
    ga4PropertyId: "987654321",
    searchConsoleSiteUrl: "https://thoylawncare.example.com/",
    gtmAccountId: "6001234567",
    gtmContainerId: "GTM-DEMO123",
    gtmWorkspaceId: "1",
  });
}

export function getTokens(userId: string, provider: IntegrationProvider) {
  return store.tokens.get(`${userId}:${provider}`) ?? null;
}

async function persistIntegration(integration: GoogleIntegration): Promise<void> {
  if (!capabilities.hasSupabaseAdmin) return;
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const tokens = store.tokens.get(`${integration.userId}:${integration.provider}`);
    await admin.from("google_integrations").upsert({
      user_id: integration.userId,
      provider: integration.provider,
      // NOTE: refresh token is already encrypted before reaching here.
      refresh_token_encrypted: tokens?.refreshTokenEncrypted ?? null,
      token_expires_at: integration.tokenExpiresAt ?? null,
      scopes: integration.scopes,
      connected_at: integration.connectedAt,
      last_sync_at: integration.lastSyncAt,
      status: integration.status,
    });
  } catch (err) {
    console.error("persistIntegration failed (kept in memory):", err);
  }
}
