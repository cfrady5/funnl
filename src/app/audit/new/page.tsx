import { AppShell } from "@/components/nav/app-shell";
import { NewAuditForm } from "@/components/audit/new-audit-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_MODE, capabilities } from "@/lib/config";
import { listBusinesses } from "@/lib/store";

export default async function NewAuditPage() {
  const user = await getCurrentUser();
  const businesses = await listBusinesses(user?.id ?? null);

  const businessOptions = businesses.map((b) => ({
    id: b.id,
    businessName: b.businessName,
    websiteUrl: b.websiteUrl,
  }));

  return (
    <AppShell demoMode={DEMO_MODE} userEmail={user?.email}>
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">New Audit</h1>
          <p className="mt-1 text-muted-foreground">
            Run a scored SEM audit from a website URL — optionally enriched with
            your connected Google data.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Audit details</CardTitle>
            <CardDescription>
              Tell us what to analyze. You can start with just a URL and connect
              data later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NewAuditForm
              businesses={businessOptions}
              canUseLiveData={capabilities.hasGoogleAds}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
