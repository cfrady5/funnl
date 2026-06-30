import type { ComponentType } from "react";
import Link from "next/link";
import {
  Check,
  X,
  ShieldCheck,
  PlugZap,
  ArrowRight,
  Database,
  KeyRound,
  Sparkles,
  Gauge,
  Lock,
} from "lucide-react";
import { AppShell } from "@/components/nav/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_MODE, capabilities } from "@/lib/config";

const CAPABILITY_ROWS: {
  label: string;
  enabled: boolean;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { label: "Supabase database", enabled: capabilities.hasSupabase, icon: Database },
  { label: "Google OAuth", enabled: capabilities.hasGoogleOAuth, icon: PlugZap },
  { label: "Google Ads API", enabled: capabilities.hasGoogleAds, icon: PlugZap },
  { label: "AI summary layer", enabled: capabilities.hasAI, icon: Sparkles },
  {
    label: "Token encryption key",
    enabled: capabilities.hasEncryptionKey,
    icon: KeyRound,
  },
  {
    label: "PageSpeed Insights",
    enabled: capabilities.hasPageSpeed,
    icon: Gauge,
  },
];

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <AppShell demoMode={DEMO_MODE} userEmail={user?.email}>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your profile, runtime mode, and data preferences.
          </p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Name
                </p>
                <p className="mt-1 text-sm font-medium">
                  {user?.name ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </p>
                <p className="mt-1 text-sm font-medium">
                  {user?.email ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mode */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mode</CardTitle>
                <CardDescription>
                  Capabilities enabled by your current configuration.
                </CardDescription>
              </div>
              {DEMO_MODE ? (
                <Badge variant="info">Local (no database)</Badge>
              ) : (
                <Badge variant="success">Connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {CAPABILITY_ROWS.map((row) => {
                const Icon = row.icon;
                return (
                  <li
                    key={row.label}
                    className="flex items-center justify-between py-3"
                  >
                    <span className="flex items-center gap-3 text-sm">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {row.label}
                    </span>
                    {row.enabled ? (
                      <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                        <Check className="h-4 w-4" /> Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <X className="h-4 w-4" /> Off
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Data & privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-blueDark" />
              Data &amp; privacy
            </CardTitle>
            <CardDescription>How we handle your account data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              OAuth refresh tokens are encrypted at rest and are never exposed to
              the client — they exist only server-side and are decrypted in
              memory for the duration of a single API call.
            </p>
            <p className="text-sm text-muted-foreground">
              For full details on data handling and self-hosting, see the{" "}
              <Link
                href="https://github.com/"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                project README
              </Link>
              .
            </p>
            <Separator />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" disabled>
                Export account data
              </Button>
              <Button variant="destructive" disabled>
                Delete account
              </Button>
              <span className="text-xs text-muted-foreground">Coming soon</span>
            </div>
          </CardContent>
        </Card>

        {/* Integrations shortcut */}
        <Link href="/integrations" className="group block">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <PlugZap className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Integrations</CardTitle>
                    <CardDescription>
                      Manage your Google Ads, GA4, Search Console &amp; GTM
                      connections.
                    </CardDescription>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </AppShell>
  );
}
