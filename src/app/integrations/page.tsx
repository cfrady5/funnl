import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Gauge,
  Info,
  LineChart,
  Search,
  Tags,
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
import { DEMO_MODE } from "@/lib/config";
import { getSelections, listIntegrations, providerLabel } from "@/lib/integrations";
import { seedDemoIntegrationsAction, saveSelectionsAction } from "@/app/actions";
import { relativeTime } from "@/lib/utils";
import type { GoogleIntegration, IntegrationProvider } from "@/lib/types";

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
  selections: ReturnType<typeof getSelections>,
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
  searchParams: Promise<{ connected?: string; demo?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const userId = user?.id ?? "demo_user";
  const integrations = listIntegrations(userId);
  const selections = getSelections(userId);

  const byProvider = new Map<IntegrationProvider, GoogleIntegration>(
    integrations.map((i) => [i.provider, i]),
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
        {params.demo === "1" && (
          <Banner variant="info" icon={Info}>
            Running in demo mode — connections are simulated with sample data.
          </Banner>
        )}
        {params.error && (
          <Banner variant="error" icon={AlertTriangle}>
            {decodeURIComponent(params.error)}
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

        {/* Demo seed card */}
        {DEMO_MODE && (
          <Card className="border-primary/30 bg-primary/[0.03]">
            <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Database className="size-5" />
                </div>
                <div>
                  <p className="font-semibold">Try it with sample data</p>
                  <p className="text-sm text-muted-foreground">
                    Load demo connections for THOY Lawncare to populate all four
                    providers and run connected audits instantly.
                  </p>
                </div>
              </div>
              <form action={seedDemoIntegrationsAction} className="shrink-0">
                <Button type="submit">Load demo connections (THOY Lawncare)</Button>
              </form>
            </CardContent>
          </Card>
        )}

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
              <input type="hidden" name="businessId" value="demo_business" />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="googleAdsCustomerId"
                  label="Google Ads customer ID"
                  placeholder="123-456-7890"
                  defaultValue={selections?.googleAdsCustomerId ?? ""}
                />
                <Field
                  id="ga4PropertyId"
                  label="GA4 property ID"
                  placeholder="987654321"
                  defaultValue={selections?.ga4PropertyId ?? ""}
                />
                <Field
                  id="searchConsoleSiteUrl"
                  label="Search Console site URL"
                  placeholder="https://example.com/"
                  defaultValue={selections?.searchConsoleSiteUrl ?? ""}
                />
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
                <Field
                  id="gtmWorkspaceId"
                  label="GTM workspace ID"
                  placeholder="1"
                  defaultValue={selections?.gtmWorkspaceId ?? ""}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                In a live workspace these are dropdowns populated from the Google
                APIs once you connect each provider. In demo mode they&apos;re
                pre-filled with the THOY Lawncare sample accounts.
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
