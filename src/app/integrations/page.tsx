import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Gauge,
  LineChart,
  Search,
  Tags,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/nav/app-shell";
import { IntegrationActions } from "@/components/integrations/integration-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_MODE, capabilities } from "@/lib/config";
import { getSelections, listIntegrations, providerLabel } from "@/lib/integrations";
import { listGoogleAccountOptions } from "@/lib/google/accounts";
import { Select } from "@/components/ui/select";
import { saveSelectionsAction } from "@/app/actions";
import { relativeTime } from "@/lib/utils";
import type { GoogleIntegration, IntegrationProvider, SelectedGoogleAccounts } from "@/lib/types";

const PROVIDER_ICON: Record<IntegrationProvider, React.ComponentType<{ className?: string }>> = {
  google_ads: Gauge,
  ga4: LineChart,
  search_console: Search,
  gtm: Tags,
};

const PROVIDER_BLURB: Record<IntegrationProvider, string> = {
  google_ads: "Campaign spend, keywords & conversions",
  ga4: "Behavior, sessions & conversion events",
  search_console: "Organic queries & search demand",
  gtm: "Tag, trigger & conversion tracking setup",
};

function selectedDetail(
  provider: IntegrationProvider,
  selections: SelectedGoogleAccounts | null,
): { label: string; value: string } | null {
  if (!selections) return null;
  switch (provider) {
    case "google_ads":
      return selections.googleAdsCustomerId
        ? { label: "Customer ID", value: selections.googleAdsCustomerId }
        : null;
    case "ga4":
      return selections.ga4PropertyId
        ? { label: "Property ID", value: selections.ga4PropertyId }
        : null;
    case "search_console":
      return selections.searchConsoleSiteUrl
        ? { label: "Site", value: selections.searchConsoleSiteUrl }
        : null;
    case "gtm":
      return selections.gtmContainerId
        ? { label: "Container", value: selections.gtmContainerId }
        : null;
    default:
      return null;
  }
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const userId = user?.id ?? "anonymous";
  const integrationsList = await listIntegrations(userId);
  const selections = await getSelections(userId);
  const connectedMap = {
    google_ads: integrationsList.some((i) => i.provider === "google_ads" && i.status === "connected"),
    ga4: integrationsList.some((i) => i.provider === "ga4" && i.status === "connected"),
    search_console: integrationsList.some((i) => i.provider === "search_console" && i.status === "connected"),
    gtm: integrationsList.some((i) => i.provider === "gtm" && i.status === "connected"),
  };
  // Live account/property/site/container options for the dropdowns (null → manual input).
  const options = await listGoogleAccountOptions(userId, connectedMap);
  const errorMessage =
    params.error === "google_not_configured"
      ? "Google sign-in isn't configured on this server yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable connecting your Google accounts."
      : params.error === "invalid_state"
        ? "The sign-in session expired. Please try connecting again."
        : params.error === "token_exchange"
          ? "We couldn't complete the Google connection. Please try again."
          : params.error
            ? decodeURIComponent(params.error)
            : null;
  const byProvider = new Map<IntegrationProvider, GoogleIntegration>(
    integrationsList.map((i) => [i.provider, i]),
  );
  const providers: IntegrationProvider[] = ["google_ads", "ga4", "search_console", "gtm"];

  return (
    <AppShell demoMode={DEMO_MODE} userEmail={user?.email}>
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Banners */}
        {params.connected === "1" && (
          <Banner variant="success" icon={CheckCircle2}>
            Connection successful. Your account is now linked.
          </Banner>
        )}
        {errorMessage && (
          <Banner variant="error" icon={AlertTriangle}>
            {errorMessage}
          </Banner>
        )}

        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
            <p className="mt-1 text-muted-foreground">
              Connect Google Ads, GA4, Search Console, and Tag Manager to unlock
              account-level, connected-data audits.
            </p>
          </div>
        </header>

        {/* Integration cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((provider) => {
            const integration = byProvider.get(provider);
            const connected = integration?.status === "connected";
            const Icon = PROVIDER_ICON[provider];
            const detail = connected ? selectedDetail(provider, selections) : null;
            return (
              <Card key={provider} className="flex flex-col">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{providerLabel(provider)}</CardTitle>
                      <CardDescription>{PROVIDER_BLURB[provider]}</CardDescription>
                    </div>
                  </div>
                  {connected ? (
                    <Badge variant="success">Connected</Badge>
                  ) : (
                    <Badge variant="low">Not connected</Badge>
                  )}
                </CardHeader>
                <CardContent className="mt-auto space-y-4">
                  <dl className="space-y-1.5 text-sm">
                    {detail && (
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-muted-foreground">{detail.label}</dt>
                        <dd className="truncate font-medium tabular-nums">{detail.value}</dd>
                      </div>
                    )}
                    {connected && (
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-muted-foreground">Last sync</dt>
                        <dd className="font-medium">
                          {integration?.lastSyncAt
                            ? relativeTime(integration.lastSyncAt)
                            : "Never"}
                        </dd>
                      </div>
                    )}
                  </dl>
                  <IntegrationActions provider={provider} connected={connected} />
                </CardContent>
              </Card>
            );
          })}

          {/* PageSpeed Insights — API-key based, not OAuth */}
          <Card className="flex flex-col">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                  <Zap className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">PageSpeed Insights</CardTitle>
                  <CardDescription>
                    Adds real Lighthouse performance + mobile scores during crawls
                  </CardDescription>
                </div>
              </div>
              {capabilities.hasPageSpeed ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Badge variant="low">Not configured</Badge>
              )}
            </CardHeader>
            <CardContent className="mt-auto space-y-4">
              <p className="text-sm text-muted-foreground">
                Set <code className="rounded bg-muted px-1 py-0.5 text-xs">PAGESPEED_API_KEY</code>{" "}
                in your environment to enable.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Account selection */}
        <Card>
          <CardHeader>
            <CardTitle>Account &amp; property selection</CardTitle>
            <CardDescription>
              Choose which Google Ads account, GA4 property, Search Console site,
              and GTM container this workspace should audit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveSelectionsAction} className="space-y-6">
              <input type="hidden" name="businessId" value="default" />
              <div className="grid gap-5 sm:grid-cols-2">
                <PickField
                  id="googleAdsCustomerId"
                  label="Google Ads account"
                  placeholder="123-456-7890"
                  defaultValue={selections?.googleAdsCustomerId ?? ""}
                  options={options.adsCustomers}
                />
                <PickField
                  id="ga4PropertyId"
                  label="GA4 property"
                  placeholder="987654321"
                  defaultValue={selections?.ga4PropertyId ?? ""}
                  options={options.ga4Properties}
                />
                <PickField
                  id="searchConsoleSiteUrl"
                  label="Search Console site"
                  placeholder="https://example.com/"
                  defaultValue={selections?.searchConsoleSiteUrl ?? ""}
                  options={options.gscSites}
                />
                {options.gtmContainers ? (
                  <div className="space-y-2">
                    <Label htmlFor="gtmSelection">GTM container</Label>
                    <Select
                      id="gtmSelection"
                      name="gtmSelection"
                      defaultValue={
                        selections?.gtmAccountId && selections?.gtmContainerId
                          ? `${selections.gtmAccountId}:${selections.gtmContainerId}`
                          : ""
                      }
                    >
                      <option value="">Choose a container…</option>
                      {options.gtmContainers.map((c) => (
                        <option key={`${c.accountId}:${c.containerId}`} value={`${c.accountId}:${c.containerId}`}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <>
                    <Field
                      id="gtmAccountId"
                      label="GTM account ID"
                      placeholder="6001234567"
                      defaultValue={selections?.gtmAccountId ?? ""}
                    />
                    <Field
                      id="gtmContainerId"
                      label="GTM container ID"
                      placeholder="GTM-XXXXXXX"
                      defaultValue={selections?.gtmContainerId ?? ""}
                    />
                  </>
                )}
                <Field
                  id="gtmWorkspaceId"
                  label="GTM workspace ID"
                  placeholder="1"
                  defaultValue={selections?.gtmWorkspaceId ?? "1"}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Connected providers show live dropdowns from the Google APIs.
                Anything not connected yet can be entered manually if you already
                know the ID.
              </p>
              <div className="flex justify-end">
                <Button type="submit">Save selections</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Error states reference */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">What happens when something&apos;s missing</CardTitle>
            <CardDescription>
              Connected audits degrade gracefully — here&apos;s what each gap means.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <ul className="space-y-3 text-sm text-muted-foreground">
              <ErrorNote icon={Gauge} title="Connected but no Ads account">
                We can still audit your site and organic demand, but paid-search
                efficiency and budget-waste scores are skipped until a customer ID
                is selected.
              </ErrorNote>
              <ErrorNote icon={LineChart} title="GA4 property not selected">
                Behavioral and conversion-event analysis is unavailable; the audit
                falls back to crawl-based landing-page signals.
              </ErrorNote>
              <ErrorNote icon={Search} title="Search Console site not verified">
                Keyword-opportunity findings are limited — we can&apos;t surface the
                organic queries you&apos;re not yet bidding on.
              </ErrorNote>
              <ErrorNote icon={BarChart3} title="GTM container missing">
                Tracking coverage can&apos;t be verified, so conversion-tracking
                recommendations rely on on-page detection only.
              </ErrorNote>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({
  id,
  label,
  placeholder,
  defaultValue,
}: {
  id: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} placeholder={placeholder} defaultValue={defaultValue} />
    </div>
  );
}

/** Dropdown when live options exist for the connected provider; input otherwise. */
function PickField({
  id,
  label,
  placeholder,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  options: { value: string; label: string }[] | null;
}) {
  if (!options || options.length === 0) {
    return <Field id={id} label={label} placeholder={placeholder} defaultValue={defaultValue} />;
  }
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} name={id} defaultValue={defaultValue}>
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

function ErrorNote({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span>
        <span className="font-medium text-foreground">{title}.</span> {children}
      </span>
    </li>
  );
}

function Banner({
  variant,
  icon: Icon,
  children,
}: {
  variant: "success" | "info" | "error";
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const styles: Record<"success" | "info" | "error", string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    error: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium ${styles[variant]}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className="size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
