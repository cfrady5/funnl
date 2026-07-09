/**
 * Account discovery for the Integrations page.
 *
 * Once a provider is connected, these helpers list the user's real Google Ads
 * customers, GA4 properties, Search Console sites, and GTM accounts/containers
 * so the account-selection form can render dropdowns instead of raw ID inputs.
 *
 * Every call degrades to `null` (→ the UI falls back to a manual input) on any
 * failure: missing token, expired grant, API not enabled, quota, etc. Nothing
 * here ever throws to the page.
 */

import { decryptToken } from "@/lib/crypto";
import { capabilities } from "@/lib/config";
import { getTokens } from "@/lib/integrations";
import { refreshAccessToken } from "./oauth";
import { createAdsService } from "./ads";
import { createGa4Service } from "./ga4";
import { createSearchConsoleService } from "./searchconsole";
import { createGtmService } from "./gtm";
import type { IntegrationProvider } from "@/lib/types";

export interface AccountOption {
  value: string;
  label: string;
}

export interface GtmContainerOption {
  accountId: string;
  containerId: string;
  label: string;
}

export interface GoogleAccountOptions {
  adsCustomers: AccountOption[] | null;
  ga4Properties: AccountOption[] | null;
  gscSites: AccountOption[] | null;
  gtmContainers: GtmContainerOption[] | null;
}

async function tokenFor(userId: string, provider: IntegrationProvider): Promise<string | null> {
  try {
    const tokens = await getTokens(userId, provider);
    if (!tokens?.refreshTokenEncrypted || tokens.refreshTokenEncrypted.startsWith("ENC_KEY_MISSING")) {
      return null;
    }
    const { accessToken } = await refreshAccessToken(decryptToken(tokens.refreshTokenEncrypted));
    return accessToken;
  } catch {
    return null;
  }
}

export async function listGoogleAccountOptions(
  userId: string,
  connected: Record<IntegrationProvider, boolean>,
): Promise<GoogleAccountOptions> {
  const empty: GoogleAccountOptions = {
    adsCustomers: null,
    ga4Properties: null,
    gscSites: null,
    gtmContainers: null,
  };
  if (!capabilities.hasGoogleOAuth) return empty;

  const [adsCustomers, ga4Properties, gscSites, gtmContainers] = await Promise.all([
    connected.google_ads && capabilities.hasGoogleAds ? listAds(userId) : Promise.resolve(null),
    connected.ga4 ? listGa4(userId) : Promise.resolve(null),
    connected.search_console ? listGsc(userId) : Promise.resolve(null),
    connected.gtm ? listGtm(userId) : Promise.resolve(null),
  ]);
  return { adsCustomers, ga4Properties, gscSites, gtmContainers };
}

async function listAds(userId: string): Promise<AccountOption[] | null> {
  const token = await tokenFor(userId, "google_ads");
  if (!token) return null;
  try {
    const ids = await createAdsService(token).listAccessibleCustomers();
    return ids.map((id) => ({ value: id, label: id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3") }));
  } catch {
    return null;
  }
}

async function listGa4(userId: string): Promise<AccountOption[] | null> {
  const token = await tokenFor(userId, "ga4");
  if (!token) return null;
  try {
    const props = await createGa4Service(token).listProperties();
    return props.map((p) => ({ value: p.propertyId, label: `${p.displayName} (${p.propertyId})` }));
  } catch {
    return null;
  }
}

async function listGsc(userId: string): Promise<AccountOption[] | null> {
  const token = await tokenFor(userId, "search_console");
  if (!token) return null;
  try {
    const sites = await createSearchConsoleService(token).listSites();
    return sites.map((s) => ({ value: s.siteUrl, label: s.siteUrl }));
  } catch {
    return null;
  }
}

async function listGtm(userId: string): Promise<GtmContainerOption[] | null> {
  const token = await tokenFor(userId, "gtm");
  if (!token) return null;
  try {
    const svc = createGtmService(token);
    const accounts = (await svc.listAccounts()) as Array<{ accountId: string; name: string }>;
    const out: GtmContainerOption[] = [];
    for (const acct of accounts.slice(0, 5)) {
      const containers = (await svc.listContainers(acct.accountId)) as Array<{
        containerId: string;
        name: string;
        publicId: string;
      }>;
      for (const c of containers) {
        out.push({
          accountId: acct.accountId,
          containerId: c.containerId,
          label: `${c.name} (${c.publicId})`,
        });
      }
    }
    return out;
  } catch {
    return null;
  }
}
